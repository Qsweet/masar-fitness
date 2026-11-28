import { err, type Result } from "../../result";
import type { ContentPermission } from "../registry";
import { checkShape, type SettingIssue } from "./check";
import {
  checkContact,
  checkFacts,
  checkRating,
  CONTACT_SHAPE,
  FACTS_SHAPE,
  PAYMENT_MARKS_SHAPE,
  RATING_SHAPE,
  SOCIAL_SHAPE,
} from "./defs/club";
import { checkHours, HOURS_SHAPE } from "./defs/hours";
import {
  ANNOUNCEMENT_SHAPE,
  checkAnnouncement,
  checkSections,
  checkTestimonials,
  FACILITIES_SHAPE,
  FAQ_SHAPE,
  pendingIssues,
  SECTIONS_SHAPE,
  TESTIMONIALS_SHAPE,
} from "./defs/home";
import { checkLegal, LEGAL_SHAPE, LOCATION_SHAPE, PROGRAM_SHAPE } from "./defs/pages";
import type { Shape, ShapeValue } from "./spec";

/**
 * سجل الإعدادات المنظَّمة (ADMIN_A3_CONTENT §5.1): لكل معرّف شكله وصلاحيته وقواعده المترابطة. القيمة
 * الغائبة من اللقطة = الافتراضي من `config/` في الويب. إضافة إعداد = سطر هنا وافتراضي هناك، بلا ترحيل.
 */
export interface SettingContext {
  /** المسارات الداخلية المعروفة الآن (روابط شريط الإعلان). */
  readonly knownPaths: ReadonlySet<string>;
}

type Check<S extends Shape> = (value: ShapeValue<S>, context: SettingContext) => SettingIssue[];

function define<S extends Shape>(
  shape: S,
  permission: ContentPermission,
  check: Check<S> = () => [],
) {
  return {
    shape,
    permission,
    /** قراءة لقطة: الشروط البنيوية وحدها، أو null. */
    read: (raw: unknown): ShapeValue<S> | null => {
      const checked = checkShape(shape, raw, { lint: false });
      return checked.ok ? checked.value : null;
    },
    /** الحفظ والنشر: كل الحقول بتدقيق النصوص، ثم القواعد المترابطة. */
    validate: (
      raw: unknown,
      context: SettingContext,
    ): Result<ShapeValue<S>, readonly SettingIssue[]> => {
      const checked = checkShape(shape, raw, { lint: true });
      if (!checked.ok) {
        return checked;
      }
      const issues = check(checked.value, context);
      return issues.length > 0 ? err(issues) : checked;
    },
  };
}

const program = () =>
  define(PROGRAM_SHAPE, "content.write", (value) => pendingIssues(value.points, "points"));
const legal = () => define(LEGAL_SHAPE, "content.facts", checkLegal);

export const SETTINGS = {
  "club.contact": define(CONTACT_SHAPE, "content.facts", checkContact),
  "club.social": define(SOCIAL_SHAPE, "content.facts"),
  "club.facts": define(FACTS_SHAPE, "content.facts", checkFacts),
  "club.rating": define(RATING_SHAPE, "content.facts", checkRating),
  "club.paymentMarks": define(PAYMENT_MARKS_SHAPE, "content.facts"),
  "club.hours": define(HOURS_SHAPE, "content.facts", checkHours),
  "home.sections": define(SECTIONS_SHAPE, "content.write", checkSections),
  "home.faq": define(FAQ_SHAPE, "content.write", (value) => pendingIssues(value.items, "items")),
  "home.facilities": define(FACILITIES_SHAPE, "content.write", (value) =>
    pendingIssues(value.items, "items"),
  ),
  "home.testimonials": define(TESTIMONIALS_SHAPE, "content.write", checkTestimonials),
  "site.announcement": define(ANNOUNCEMENT_SHAPE, "content.write", (value, context) =>
    checkAnnouncement(value, context.knownPaths),
  ),
  "legal.terms": legal(),
  "legal.returns": legal(),
  "page.location": define(LOCATION_SHAPE, "content.write"),
  "program.personalTraining": program(),
  "program.rehab": program(),
  "program.swimming": program(),
} as const;

export type SettingId = keyof typeof SETTINGS;
// Object.keys على كائن حرفي ثابت: مفاتيحه هي SettingId بالتعريف
export const SETTING_IDS = Object.keys(SETTINGS) as SettingId[];

export function isSettingId(value: string): value is SettingId {
  return Object.hasOwn(SETTINGS, value);
}

/** القيمة المطبوعة لكل إعداد، من شكله. */
export type SettingValues = {
  readonly [I in SettingId]: NonNullable<ReturnType<(typeof SETTINGS)[I]["read"]>>;
};
