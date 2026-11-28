import type { SettingIssue } from "../check";
import { daySpan } from "../formats";
import { bool, choice, fieldPath, list, localized, text, type ShapeValue } from "../spec";

/**
 * إعدادات الرئيسية والموقع (ADMIN_A3_CONTENT §5.3، WP8–WP10): ترتيب الأقسام وإخفاؤها، الأسئلة الشائعة،
 * قائمة المرافق، آراء الأعضاء، شريط الإعلان. البند «بانتظار تأكيد المالك» (`pending`) لا يظهر في
 * الموقع حتى يُرفع عنه التعليق.
 */
export const HOME_SECTION_IDS = [
  "highlights",
  "goals",
  "facilities",
  "stats",
  "plans",
  "about",
  "services",
  "team",
  "reviews",
  "faq",
  "hours",
  "cta",
  "contact",
] as const;
export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];
/** أهداف تحويل الروابط القديمة وشريط الشراء: لا تُخفى. */
export const REQUIRED_HOME_SECTIONS: readonly HomeSectionId[] = ["plans", "about", "contact"];

export const SECTIONS_SHAPE = {
  /** عرض الأصدقاء تحت الاشتراكات: مخفي حتى يؤكد المالك شروطه. */
  friendsOffer: bool(),
  items: list({ id: choice(HOME_SECTION_IDS), visible: bool() }, HOME_SECTION_IDS.length, true),
};
export type SectionsSetting = ShapeValue<typeof SECTIONS_SHAPE>;

export function checkSections(value: SectionsSetting): SettingIssue[] {
  const ids = value.items.map((item) => item.id);
  const complete =
    ids.length === HOME_SECTION_IDS.length && HOME_SECTION_IDS.every((id) => ids.includes(id));
  if (!complete) {
    return [{ field: "items", reason: "settings.sections_incomplete" }];
  }
  return value.items.flatMap((item, index) =>
    !item.visible && REQUIRED_HOME_SECTIONS.includes(item.id)
      ? [
          {
            field: fieldPath(fieldPath("items", index), "visible"),
            reason: "settings.section_required",
          },
        ]
      : [],
  );
}

/** الأقسام الظاهرة بترتيبها. */
export function visibleSections(value: SectionsSetting): HomeSectionId[] {
  return value.items.filter((item) => item.visible).map((item) => item.id);
}

const QUESTION_MAX = 160;
const ANSWER_MAX = 700;
export const FAQ_MAX_ITEMS = 30;

export const FAQ_SHAPE = {
  items: list(
    {
      question: localized(QUESTION_MAX, "ar"),
      answer: localized(ANSWER_MAX, "ar"),
      visible: bool(),
      pending: bool(),
    },
    FAQ_MAX_ITEMS,
  ),
};
export type FaqSetting = ShapeValue<typeof FAQ_SHAPE>;

interface Reviewable {
  readonly visible: boolean;
  readonly pending: boolean;
}

/** بند ظاهر وهو «بانتظار تأكيد المالك»: يُرفض؛ التأكيد قبل الإظهار. */
export function pendingIssues(items: readonly Reviewable[], listPath: string): SettingIssue[] {
  return items.flatMap((item, index) =>
    item.visible && item.pending
      ? [
          {
            field: fieldPath(fieldPath(listPath, index), "visible"),
            reason: "settings.pending_visible",
          },
        ]
      : [],
  );
}

export const FACILITY_ICONS = ["dumbbell", "waves", "flame", "users", "heart", "clock"] as const;
export type FacilityIcon = (typeof FACILITY_ICONS)[number];
const FACILITY_NAME_MAX = 40;
const FACILITY_DETAIL_MAX = 160;
const FACILITIES_MAX = 12;

export const FACILITIES_SHAPE = {
  items: list(
    {
      icon: choice(FACILITY_ICONS),
      name: localized(FACILITY_NAME_MAX, "both"),
      detail: localized(FACILITY_DETAIL_MAX, "none"),
      visible: bool(),
      pending: bool(),
    },
    FACILITIES_MAX,
  ),
};
export type FacilitiesSetting = ShapeValue<typeof FACILITIES_SHAPE>;

export const TESTIMONIAL_SOURCES = ["google", "member"] as const;
const QUOTE_MAX = 400;
const AUTHOR_MAX = 60;
const TESTIMONIALS_MAX = 12;

/** رأي عضو: لا يظهر إلا بموافقة صاحبه المسجَّلة هنا. */
export const TESTIMONIALS_SHAPE = {
  items: list(
    {
      quote: localized(QUOTE_MAX, "ar"),
      author: text("plain", AUTHOR_MAX),
      source: choice(TESTIMONIAL_SOURCES),
      consent: bool(),
      visible: bool(),
    },
    TESTIMONIALS_MAX,
  ),
};
export type TestimonialsSetting = ShapeValue<typeof TESTIMONIALS_SHAPE>;

export function checkTestimonials(value: TestimonialsSetting): SettingIssue[] {
  return value.items.flatMap((item, index) =>
    item.visible && !item.consent
      ? [
          {
            field: fieldPath(fieldPath("items", index), "consent"),
            reason: "settings.consent_required",
          },
        ]
      : [],
  );
}

export const ANNOUNCEMENT_LINK_KINDS = ["none", "internal", "whatsapp"] as const;
const ANNOUNCEMENT_TEXT_MAX = 160;
const LINK_LABEL_MAX = 40;
const PATH_MAX = 120;
const DATE_MAX = 10;
export const ANNOUNCEMENT_MAX_DAYS = 90;

export const ANNOUNCEMENT_SHAPE = {
  enabled: bool(),
  text: localized(ANNOUNCEMENT_TEXT_MAX, "none"),
  linkKind: choice(ANNOUNCEMENT_LINK_KINDS),
  linkPath: text("path", PATH_MAX),
  linkLabel: localized(LINK_LABEL_MAX, "none"),
  from: text("date", DATE_MAX),
  to: text("date", DATE_MAX),
  dismissible: bool(),
};
export type AnnouncementSetting = ShapeValue<typeof ANNOUNCEMENT_SHAPE>;

function windowIssue(value: AnnouncementSetting): SettingIssue | null {
  if (value.from === "" || value.to === "") {
    return null;
  }
  const span = daySpan(value.from, value.to);
  if (span !== null && span < 1) {
    return { field: "to", reason: "settings.range_order" };
  }
  return span !== null && span > ANNOUNCEMENT_MAX_DAYS
    ? { field: "to", reason: "settings.window_too_long" }
    : null;
}

export function checkAnnouncement(
  value: AnnouncementSetting,
  knownPaths: ReadonlySet<string>,
): SettingIssue[] {
  const issues: SettingIssue[] = [];
  const required = (field: string, missing: boolean) => {
    if (missing) {
      issues.push({ field, reason: "settings.required" });
    }
  };
  if (value.enabled) {
    required("text.ar", value.text.ar === "");
    required("text.en", value.text.en === "");
  }
  if (value.linkKind !== "none") {
    required("linkLabel.ar", value.linkLabel.ar === "");
    required("linkLabel.en", value.linkLabel.en === "");
  }
  if (value.linkKind === "internal" && !knownPaths.has(value.linkPath)) {
    issues.push({ field: "linkPath", reason: "slider.link_unknown" });
  }
  const window = windowIssue(value);
  return window === null ? issues : [...issues, window];
}

/** الإعلان يسري اليوم بتقويم النادي: مفعَّل وداخل نافذته (الطرف الفارغ مفتوح). */
export function isAnnouncementLive(value: AnnouncementSetting, today: string): boolean {
  return (
    value.enabled &&
    value.text.ar !== "" &&
    (value.from === "" || value.from <= today) &&
    (value.to === "" || today <= value.to)
  );
}
