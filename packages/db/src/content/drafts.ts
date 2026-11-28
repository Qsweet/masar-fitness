/**
 * مسودة المحتوى (ADMIN_A3_CONTENT §8.2): صف لكل مفتاح ولغة بقفل متفائل (`updated_at`)، والإعداد
 * المنظَّم (§5) صف واحد بمفتاح `setting:<معرّف>` ولغة `*`. الحفظ تحت قفل
 * محتوى النادي: رمز قديم لمفتاح ⇒ يُرفض ذلك المفتاح وحده ولا يُكتب شيء من الطلب، بلا دمج صامت.
 * «عودة إلى الافتراضي» تكتب NULL (لا حذف أثناء التحرير)، فيظهر في الفرق «إزالة تجاوز».
 */
import {
  err,
  ok,
  type DraftEntry,
  type Result,
  type SettingObject,
  type TextOverride,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { DomainError } from "@masar/domain";
import { lockContent } from "./lock";

export const CONTENT_DRAFT_SAVED = "content_draft_saved";

export interface DraftRow extends DraftEntry {
  readonly value: TextOverride | null;
  /** القيمة كما في القاعدة: صف الإعداد المنظَّم (`setting:<معرّف>`) يحمل كائنه هنا. */
  readonly raw: unknown;
  /** رمز القفل المتفائل. */
  readonly lockToken: string;
  readonly updatedBy: string;
  readonly updatedAt: Date;
}

interface RawRow {
  readonly entry_key: string;
  readonly locale: string;
  readonly value: unknown;
  readonly updated_by: string;
  readonly updated_at: Date;
}

/** رمز الصف الغائب: «لم يُكتب بعد». */
export const ABSENT_LOCK_TOKEN = "";

function overrideOf(value: unknown): TextOverride | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = Object.fromEntries(Object.entries(value));
  return typeof record.value === "string" && typeof record.baseHash === "string"
    ? { value: record.value, baseHash: record.baseHash }
    : null;
}

function rowOf(row: RawRow): DraftRow {
  return {
    key: row.entry_key,
    locale: row.locale,
    value: overrideOf(row.value),
    raw: row.value,
    lockToken: String(row.updated_at.getTime()),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function listDraftEntries(db: Db | Tx, clubId: string): Promise<DraftRow[]> {
  const rows = await db.$queryRaw<RawRow[]>`
    SELECT entry_key, locale, value, updated_by::text AS updated_by, updated_at
    FROM content_draft_entries WHERE club_id = ${clubId}::uuid ORDER BY entry_key, locale`;
  return rows.map(rowOf);
}

export interface DraftChange {
  readonly key: string;
  readonly locale: string;
  /** تجاوز نص، أو كائن إعداد منظَّم (المفتاح `setting:` واللغة `*`)؛ null = عودة إلى الافتراضي. */
  readonly value: TextOverride | SettingObject | null;
  readonly lockToken: string;
}

export interface SaveDraftInput {
  readonly clubId: string;
  readonly staffId: string;
  readonly actor: StaffAuditActor;
  /** المساحة التي حُفظت (للتدقيق، قيمةً لا مفتاحًا: المسار قد يطابق نمط البيانات الشخصية). */
  readonly target: string;
  readonly changes: readonly DraftChange[];
  readonly now: Date;
}

export class DraftConflict extends DomainError {
  /** «المفتاح|اللغة» لكل صف تغيّر بعد فتح الصفحة. */
  readonly stale: readonly string[];

  constructor(stale: readonly string[]) {
    super("conflict", "content.stale_edit");
    this.stale = stale;
  }
}

export function changeId(key: string, locale: string): string {
  return `${key}|${locale}`;
}

async function writeChange(
  tx: Tx,
  input: SaveDraftInput,
  change: DraftChange,
  previous: Date | undefined,
) {
  const at = new Date(Math.max(input.now.getTime(), (previous?.getTime() ?? 0) + 1));
  const value = change.value === null ? null : JSON.stringify(change.value);
  await tx.$executeRaw`
    INSERT INTO content_draft_entries (club_id, entry_key, locale, value, updated_by, updated_at)
    VALUES (${input.clubId}::uuid, ${change.key}, ${change.locale}, ${value}::jsonb,
      ${input.staffId}::uuid, ${at})
    ON CONFLICT (club_id, entry_key, locale)
    DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`;
}

async function saveInTransaction(
  tx: Tx,
  input: SaveDraftInput,
): Promise<Result<number, DomainError>> {
  await lockContent(tx, input.clubId);
  const current = new Map(
    (await listDraftEntries(tx, input.clubId)).map((row) => [changeId(row.key, row.locale), row]),
  );
  const stale = input.changes
    .filter((change) => {
      const token =
        current.get(changeId(change.key, change.locale))?.lockToken ?? ABSENT_LOCK_TOKEN;
      return token !== change.lockToken;
    })
    .map((change) => changeId(change.key, change.locale));
  if (stale.length > 0) {
    return err(new DraftConflict(stale));
  }
  for (const change of input.changes) {
    await writeChange(
      tx,
      input,
      change,
      current.get(changeId(change.key, change.locale))?.updatedAt,
    );
  }
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: "content_draft",
    entityId: input.clubId,
    action: CONTENT_DRAFT_SAVED,
    fromState: null,
    toState: null,
    actor: input.actor,
    data: { target: input.target, changedCount: input.changes.length },
    at: input.now,
  });
  return ok(input.changes.length);
}

/** يحفظ التغييرات كلها أو لا شيء، مع سطر تدقيق واحد. رمز قديم لأي صف ⇒ `DraftConflict` بصفوفه. */
export function saveDraftEntries(
  db: Db,
  input: SaveDraftInput,
): Promise<Result<number, DomainError>> {
  if (input.changes.length === 0) {
    return Promise.resolve(err(new DomainError("validation", "content.no_changes")));
  }
  return inTransaction(db, (tx) => saveInTransaction(tx, input));
}
