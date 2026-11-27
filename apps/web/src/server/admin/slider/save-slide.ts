import "server-only";
import {
  createSlide,
  loadDraftSlider,
  saveSliderSettings,
  staffActor,
  updateSlide,
} from "@masar/db";
import {
  diffSlider,
  err,
  ok,
  parseWholeNumber,
  SLIDER_INTERVAL_MAX_MS,
  SLIDER_INTERVAL_MIN_MS,
  type DomainError,
  type Result,
  type SlideContent,
} from "@masar/domain";
import { getDb } from "../../db";
import { knownSlidePaths } from "../../content/slider-links";
import { clubTimezone } from "../content/timezone";
import { failureOf, formFailure, type FormFailure, type FormValues } from "../field-form";
import { isUuid } from "../form";
import type { StaffContext } from "../session";
import { parseSlide } from "./slide-form";
import { SLIDE_FIELDS } from "./slide-form-names";

/**
 * حفظ الشريحة وإعدادات الشريط في المسودة (docs/ADMIN_A3_SLIDER.md §11): التحقق كاملًا ثم الكتابة تحت
 * قفل المحتوى بالقفل المتفائل. الموقع لا يتغير حتى النشر.
 */
export type SaveOutcome = Result<{ readonly id: string; readonly created: boolean }, FormFailure>;

const MS_PER_SECOND = 1_000;

function who(context: StaffContext, now: Date) {
  const { staff } = context;
  return { clubId: staff.clubId, staffId: staff.id, actor: staffActor(staff.id), now };
}

function refused(error: DomainError): Result<never, FormFailure> {
  return err(failureOf(error));
}

/** أسماء الحقول التي تغيّرت عن المحفوظ (للتدقيق وللرفض بلا تغيير). */
async function changedFields(clubId: string, id: string, content: SlideContent) {
  const draft = await loadDraftSlider(getDb(), clubId);
  const current = draft.slides.find((slide) => slide.id === id);
  if (current === undefined) {
    return null;
  }
  const settings = draft.settings;
  const [change] = diffSlider(
    { settings, slides: [current] },
    { settings, slides: [{ ...content, id }] },
  );
  return change?.kind === "changed" ? change.fields : [];
}

async function update(
  context: StaffContext,
  values: FormValues,
  content: SlideContent,
  now: Date,
): Promise<SaveOutcome> {
  const id = values[SLIDE_FIELDS.id] ?? "";
  const changed = await changedFields(context.staff.clubId, id, content);
  if (changed === null) {
    return err(formFailure("slider.not_found"));
  }
  if (changed.length === 0) {
    return err(formFailure("slider.no_changes"));
  }
  const saved = await updateSlide(getDb(), {
    ...who(context, now),
    id,
    lockToken: values[SLIDE_FIELDS.lockToken] ?? "",
    content,
    changed,
  });
  return saved.ok ? ok({ id, created: false }) : refused(saved.error);
}

export async function saveSlide(
  context: StaffContext,
  values: FormValues,
  now: Date,
): Promise<SaveOutcome> {
  const { clubId } = context.staff;
  const id = values[SLIDE_FIELDS.id] ?? "";
  if (id !== "" && !isUuid(id)) {
    return err(formFailure("staff.invalid_request"));
  }
  const parsed = await parseSlide(clubId, values, {
    knownPaths: await knownSlidePaths(),
    timeZone: await clubTimezone(clubId),
  });
  if (!parsed.ok) {
    return parsed;
  }
  if (id !== "") {
    return update(context, values, parsed.value, now);
  }
  const created = await createSlide(getDb(), { ...who(context, now), content: parsed.value });
  return created.ok ? ok({ id: created.value, created: true }) : refused(created.error);
}

export interface SettingsSubmission {
  readonly autoplay: boolean;
  readonly intervalSeconds: string;
  readonly lockToken: string;
}

export async function saveSettings(
  context: StaffContext,
  input: SettingsSubmission,
  now: Date,
): Promise<Result<string, FormFailure>> {
  const seconds = parseWholeNumber(input.intervalSeconds);
  const intervalMs = seconds === null ? null : seconds * MS_PER_SECOND;
  if (
    intervalMs === null ||
    intervalMs < SLIDER_INTERVAL_MIN_MS ||
    intervalMs > SLIDER_INTERVAL_MAX_MS
  ) {
    return err({ error: null, fields: { interval: "slider.interval_invalid" } });
  }
  const saved = await saveSliderSettings(getDb(), {
    ...who(context, now),
    settings: { autoplay: input.autoplay, intervalMs },
    lockToken: input.lockToken,
  });
  return saved.ok ? ok(saved.value) : refused(saved.error);
}
