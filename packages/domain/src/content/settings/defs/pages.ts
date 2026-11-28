import type { SettingIssue } from "../check";
import { bool, list, localized, text, type ShapeValue } from "../spec";

/**
 * محتوى الصفحات المنظَّم: الصفحتان القانونيتان (أقسام بعنوان وفقرات، بلا HTML)، وصفحة الموقع، وصفحات
 * البرامج. الصفحة القانونية لا تُنشر إلا بعد مراجعة مختص قانوني مسجَّلة هنا.
 */
const HEADING_MAX = 90;
const INTRO_MAX = 700;
const BODY_MAX = 2000;
const DATE_MAX = 10;
const LEGAL_SECTIONS_MAX = 30;

export const LEGAL_SHAPE = {
  published: bool(),
  /** «راجعه مختص قانوني»: شرط النشر. */
  reviewed: bool(),
  updatedOn: text("date", DATE_MAX),
  intro: localized(INTRO_MAX, "none", { multiline: true, money: true }),
  sections: list(
    {
      heading: localized(HEADING_MAX, "ar"),
      body: localized(BODY_MAX, "ar", { multiline: true, money: true }),
    },
    LEGAL_SECTIONS_MAX,
  ),
};
export type LegalSetting = ShapeValue<typeof LEGAL_SHAPE>;

export function checkLegal(value: LegalSetting): SettingIssue[] {
  if (!value.published) {
    return [];
  }
  const issues: SettingIssue[] = [];
  if (!value.reviewed) {
    issues.push({ field: "published", reason: "settings.legal_review_required" });
  }
  if (value.updatedOn === "") {
    issues.push({ field: "updatedOn", reason: "settings.required" });
  }
  if (value.sections.length === 0) {
    issues.push({ field: "sections", reason: "settings.list_empty" });
  }
  return issues;
}

const NOTE_MAX = 240;

/** صفحة الموقع والاتجاهات: ما لا يُعرف (المواقف) يبقى فارغًا فلا يُعرض. */
export const LOCATION_SHAPE = {
  parking: localized(NOTE_MAX, "none"),
  arrival: localized(NOTE_MAX, "none"),
};
export type LocationSetting = ShapeValue<typeof LOCATION_SHAPE>;

export const PROGRAM_IDS = ["personalTraining", "rehab", "swimming"] as const;
export type ProgramId = (typeof PROGRAM_IDS)[number];
const SUMMARY_MAX = 240;
const POINT_MAX = 160;
const POINTS_MAX = 10;

/** صفحة برنامج: وصف ونقاط «ماذا يشمل». لا سعر هنا: السعر من الكتالوج حين يُضاف، وقبله عند التواصل. */
export const PROGRAM_SHAPE = {
  summary: localized(SUMMARY_MAX, "both"),
  note: localized(NOTE_MAX, "none"),
  points: list({ text: localized(POINT_MAX, "ar"), visible: bool(), pending: bool() }, POINTS_MAX),
};
export type ProgramSetting = ShapeValue<typeof PROGRAM_SHAPE>;
