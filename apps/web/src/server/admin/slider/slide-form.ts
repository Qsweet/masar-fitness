import "server-only";
import { findAsset, type MediaAsset } from "@masar/db";
import {
  CONTENT_LOCALES,
  SLIDE_TEXT_FIELDS,
  validateSlide,
  type ContentLocale,
  type SlideContent,
  type SlideContext,
  type SlideIssue,
  type SlideTextField,
  type Result,
} from "@masar/domain";
import { readFormValues, type FormFailure, type FormValues } from "../field-form";
import { altField, SLIDE_FIELDS, textFieldName } from "./slide-form-names";
import { getDb } from "../../db";
import { isUuid } from "../form";

/**
 * نموذج الشريحة ← مدخل المجال (docs/ADMIN_A3_SLIDER.md §2، §11): أسماء الحقول ثابتة هنا ويقرؤها
 * المكوّن، والصورتان تُقرآن من مكتبة نادي الموظف وحدها (معرّف نادٍ آخر لا يُقبل). أخطاء المجال تعود
 * إلى حقولها بأسبابها وتفاصيلها، وما كُتب يعود كما هو.
 */
/** أقصى طول خام قبل أي معالجة: أربعة أضعاف أطول حد، والرابط 500 بهامش. */
const RAW = { text: 1_000, url: 2_000, short: 40, token: 20, id: 36 };
const CHECKED = "on";

function limits(): Record<string, number> {
  const texts = CONTENT_LOCALES.flatMap((locale): [string, number][] => [
    [altField(locale), RAW.text],
    ...SLIDE_TEXT_FIELDS.map((field): [string, number] => [textFieldName(locale, field), RAW.text]),
  ]);
  return {
    ...Object.fromEntries(texts),
    [SLIDE_FIELDS.id]: RAW.id,
    [SLIDE_FIELDS.lockToken]: RAW.token,
    [SLIDE_FIELDS.desktop]: RAW.id,
    [SLIDE_FIELDS.mobile]: RAW.id,
    [SLIDE_FIELDS.decorative]: RAW.short,
    [SLIDE_FIELDS.linkKind]: RAW.short,
    [SLIDE_FIELDS.linkInternal]: RAW.text,
    [SLIDE_FIELDS.linkExternal]: RAW.url,
    [SLIDE_FIELDS.linkNewTab]: RAW.short,
    [SLIDE_FIELDS.clickTarget]: RAW.short,
    [SLIDE_FIELDS.active]: RAW.short,
    [SLIDE_FIELDS.startsAt]: RAW.short,
    [SLIDE_FIELDS.endsAt]: RAW.short,
  };
}

export function readSlideValues(formData: FormData): FormValues {
  return readFormValues(formData, limits());
}

async function assetOf(clubId: string, raw: string | undefined): Promise<MediaAsset | null> {
  return raw !== undefined && isUuid(raw) ? findAsset(getDb(), clubId, raw) : null;
}

function texts(values: FormValues) {
  const of = (locale: ContentLocale) =>
    Object.fromEntries(
      SLIDE_TEXT_FIELDS.map((field) => [field, values[textFieldName(locale, field)] ?? ""]),
    ) as Record<SlideTextField, string>;
  return { ar: of("ar"), en: of("en") };
}

function failureOf(issues: readonly SlideIssue[]): FormFailure {
  return {
    error: null,
    fields: Object.fromEntries(issues.map((issue) => [issue.field, issue.reason])),
    fieldDetails: Object.fromEntries(
      issues.flatMap((issue) => (issue.detail === undefined ? [] : [[issue.field, issue.detail]])),
    ),
  };
}

function inputOf(values: FormValues, desktop: MediaAsset | null, mobile: MediaAsset | null) {
  const read = (name: string) => values[name] ?? "";
  return {
    desktop,
    mobile,
    decorative: read(SLIDE_FIELDS.decorative) === CHECKED,
    alt: { ar: read(altField("ar")), en: read(altField("en")) },
    texts: texts(values),
    link: {
      kind: read(SLIDE_FIELDS.linkKind),
      internal: read(SLIDE_FIELDS.linkInternal),
      external: read(SLIDE_FIELDS.linkExternal),
      newTab: read(SLIDE_FIELDS.linkNewTab) === CHECKED,
    },
    clickTarget: read(SLIDE_FIELDS.clickTarget),
    active: read(SLIDE_FIELDS.active) === CHECKED,
    startsAt: read(SLIDE_FIELDS.startsAt),
    endsAt: read(SLIDE_FIELDS.endsAt),
  };
}

/** القيم ← شريحة متحقَّق منها، أو أخطاء حقولها. */
export async function parseSlide(
  clubId: string,
  values: FormValues,
  context: SlideContext,
): Promise<Result<SlideContent, FormFailure>> {
  const desktop = await assetOf(clubId, values[SLIDE_FIELDS.desktop]);
  const mobileRaw = values[SLIDE_FIELDS.mobile] ?? "";
  const mobile = mobileRaw === "" ? null : await assetOf(clubId, mobileRaw);
  if (mobileRaw !== "" && mobile === null) {
    return { ok: false, error: failureOf([{ field: "mobile", reason: "slider.image_unknown" }]) };
  }
  const result = validateSlide(inputOf(values, desktop, mobile), context);
  return result.ok ? result : { ok: false, error: failureOf(result.error) };
}
