/**
 * كتابة الشريط في المسودة (ADMIN_A3_SLIDER §11): إنشاء شريحة وتعديلها وتحريكها وإزالتها، وإعدادات
 * الشريط. كلها تحت قفل المحتوى (فالنشر يلتقط مسودة لا تتغير تحته)، والتعديل والإزالة والإعدادات بقفل
 * متفائل: رمز قديم ⇒ `slider.stale_edit` بلا دمج صامت. الترتيب كثيف يُعاد كتابته كله.
 */
import { randomUUID } from "node:crypto";
import {
  DomainError,
  err,
  MAX_SLIDES,
  moveSlide,
  ok,
  type MoveDirection,
  type Result,
  type SlideContent,
  type SliderSettings,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type AuditValue, type StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { lockContent } from "./lock";
import { loadDraftSlider, lockTokenOf, type DraftSlide } from "./slides-read";
import { slideColumns } from "./slide-columns";

export const SLIDER_AUDIT_ACTIONS = [
  "content_slide_created",
  "content_slide_updated",
  "content_slide_moved",
  "content_slide_removed",
  "content_slider_settings_saved",
] as const;
type SliderAuditAction = (typeof SLIDER_AUDIT_ACTIONS)[number];

export interface SliderActor {
  readonly clubId: string;
  readonly staffId: string;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

function stale(): Result<never, DomainError> {
  return err(new DomainError("conflict", "slider.stale_edit"));
}

function notFound(): Result<never, DomainError> {
  return err(new DomainError("not_found", "slider.not_found"));
}

/** وقت كتابة أحدث من الرمز السابق بمللي ثانية على الأقل: الرمز يتغير مع كل كتابة. */
function nextStamp(now: Date, previous: Date | null): Date {
  return new Date(Math.max(now.getTime(), (previous?.getTime() ?? 0) + 1));
}

async function audit(
  tx: Tx,
  input: SliderActor,
  entityId: string,
  action: SliderAuditAction,
  data: Readonly<Record<string, AuditValue>>,
) {
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: action === "content_slider_settings_saved" ? "content_draft" : "content_slide",
    entityId,
    action,
    fromState: null,
    toState: null,
    actor: input.actor,
    data,
    at: input.now,
  });
}

async function writePositions(tx: Tx, ids: readonly string[]): Promise<void> {
  for (const [position, id] of ids.entries()) {
    await tx.contentSlide.update({ where: { id }, data: { position } });
  }
}

export interface CreateSlideInput extends SliderActor {
  readonly content: SlideContent;
}

async function createInTransaction(
  tx: Tx,
  input: CreateSlideInput,
): Promise<Result<string, DomainError>> {
  await lockContent(tx, input.clubId);
  const draft = await loadDraftSlider(tx, input.clubId);
  if (draft.slides.length >= MAX_SLIDES) {
    return err(new DomainError("validation", "slider.too_many"));
  }
  const id = randomUUID();
  const position = draft.slides.length;
  await tx.contentSlide.create({
    data: {
      id,
      clubId: input.clubId,
      position,
      ...slideColumns(input.content),
      createdBy: input.staffId,
      createdAt: input.now,
      updatedBy: input.staffId,
      updatedAt: input.now,
    },
  });
  await audit(tx, input, id, "content_slide_created", { position });
  return ok(id);
}

/** شريحة جديدة في آخر المسودة. */
export function createSlide(db: Db, input: CreateSlideInput): Promise<Result<string, DomainError>> {
  return inTransaction(db, (tx) => createInTransaction(tx, input));
}

interface Locked {
  readonly id: string;
  readonly lockToken: string;
}

async function lockedSlide(
  tx: Tx,
  input: SliderActor & Locked,
): Promise<Result<{ slide: DraftSlide; order: string[] }, DomainError>> {
  await lockContent(tx, input.clubId);
  const draft = await loadDraftSlider(tx, input.clubId);
  const slide = draft.slides.find((item) => item.id === input.id);
  if (slide === undefined) {
    return notFound();
  }
  if (slide.lockToken !== input.lockToken) {
    return stale();
  }
  return ok({ slide, order: draft.slides.map((item) => item.id) });
}

export interface UpdateSlideInput extends SliderActor, Locked {
  readonly content: SlideContent;
  /** أسماء الحقول المتغيرة للتدقيق (الفرق يحسبه المستدعي). */
  readonly changed: readonly string[];
}

async function updateInTransaction(
  tx: Tx,
  input: UpdateSlideInput,
): Promise<Result<string, DomainError>> {
  const locked = await lockedSlide(tx, input);
  if (!locked.ok) {
    return locked;
  }
  const updatedAt = nextStamp(input.now, locked.value.slide.updatedAt);
  await tx.contentSlide.update({
    where: { id: input.id },
    data: { ...slideColumns(input.content), updatedBy: input.staffId, updatedAt },
  });
  await audit(tx, input, input.id, "content_slide_updated", { fields: input.changed.join(",") });
  return ok(lockTokenOf(updatedAt));
}

/** يحفظ تعديل شريحة برمز قفلها؛ يرجع رمزها الجديد. */
export function updateSlide(db: Db, input: UpdateSlideInput): Promise<Result<string, DomainError>> {
  return inTransaction(db, (tx) => updateInTransaction(tx, input));
}

export interface MoveSlideInput extends SliderActor {
  readonly id: string;
  readonly direction: MoveDirection;
}

async function moveInTransaction(
  tx: Tx,
  input: MoveSlideInput,
): Promise<Result<number, DomainError>> {
  await lockContent(tx, input.clubId);
  const draft = await loadDraftSlider(tx, input.clubId);
  const order = draft.slides.map((slide) => slide.id);
  if (!order.includes(input.id)) {
    return notFound();
  }
  const next = moveSlide(order, input.id, input.direction);
  if (next === null) {
    return err(new DomainError("validation", "slider.move_edge"));
  }
  await writePositions(tx, next);
  const position = next.indexOf(input.id);
  await audit(tx, input, input.id, "content_slide_moved", { position });
  return ok(position);
}

/** يحرّك شريحة خطوة (التحريك لا يغيّر رمز قفلها: الترتيب ليس في نموذج الشريحة). */
export function moveSlideInDraft(
  db: Db,
  input: MoveSlideInput,
): Promise<Result<number, DomainError>> {
  return inTransaction(db, (tx) => moveInTransaction(tx, input));
}

async function removeInTransaction(
  tx: Tx,
  input: SliderActor & Locked,
): Promise<Result<number, DomainError>> {
  const locked = await lockedSlide(tx, input);
  if (!locked.ok) {
    return locked;
  }
  await tx.contentSlide.delete({ where: { id: input.id } });
  const remaining = locked.value.order.filter((id) => id !== input.id);
  await writePositions(tx, remaining);
  await audit(tx, input, input.id, "content_slide_removed", {
    position: locked.value.slide.position,
  });
  return ok(remaining.length);
}

/** يزيل شريحة من المسودة (المنشور لا يتغير حتى النشر)، ويعيد ترتيب الباقي كثيفًا. */
export function removeSlide(
  db: Db,
  input: SliderActor & Locked,
): Promise<Result<number, DomainError>> {
  return inTransaction(db, (tx) => removeInTransaction(tx, input));
}

export interface SaveSettingsInput extends SliderActor {
  readonly settings: SliderSettings;
  readonly lockToken: string;
}

async function settingsInTransaction(
  tx: Tx,
  input: SaveSettingsInput,
): Promise<Result<string, DomainError>> {
  await lockContent(tx, input.clubId);
  const draft = await loadDraftSlider(tx, input.clubId);
  if (draft.settingsToken !== input.lockToken) {
    return stale();
  }
  const updatedAt = nextStamp(input.now, draft.settingsUpdatedAt);
  const values = { ...input.settings, updatedBy: input.staffId, updatedAt };
  await tx.contentSliderSettings.upsert({
    where: { clubId: input.clubId },
    create: { clubId: input.clubId, ...values },
    update: values,
  });
  await audit(tx, input, input.clubId, "content_slider_settings_saved", {
    autoplay: input.settings.autoplay,
    intervalMs: input.settings.intervalMs,
  });
  return ok(lockTokenOf(updatedAt));
}

export function saveSliderSettings(
  db: Db,
  input: SaveSettingsInput,
): Promise<Result<string, DomainError>> {
  return inTransaction(db, (tx) => settingsInTransaction(tx, input));
}
