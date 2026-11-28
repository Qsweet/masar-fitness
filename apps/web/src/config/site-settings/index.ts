import type { SettingValues } from "@masar/domain";
import {
  CONTACT_DEFAULT,
  FACTS_DEFAULT,
  HOURS_DEFAULT,
  PAYMENT_MARKS_DEFAULT,
  RATING_DEFAULT,
  SOCIAL_DEFAULT,
} from "./club";
import {
  ANNOUNCEMENT_DEFAULT,
  FACILITIES_DEFAULT,
  FAQ_DEFAULT,
  SECTIONS_DEFAULT,
  TESTIMONIALS_DEFAULT,
} from "./home";
import { RETURNS_DEFAULT, TERMS_DEFAULT } from "./legal";
import {
  LOCATION_DEFAULT,
  PERSONAL_TRAINING_DEFAULT,
  REHAB_DEFAULT,
  SWIMMING_DEFAULT,
} from "./pages";

/**
 * افتراضيات الإعدادات المنظَّمة (ADMIN_A3_CONTENT §5): القيمة الغائبة من الإصدار المنشور = هذه. اختبار
 * `defaults.test.ts` يمررها كلها بتحقق الحفظ نفسه (الشكل، وتدقيق النصوص، والقواعد المترابطة)، ويثبت أن
 * لا بند معلَّقًا ظاهر وأن الصفحتين القانونيتين غير منشورتين.
 */
export const SITE_SETTING_DEFAULTS: SettingValues = {
  "club.contact": CONTACT_DEFAULT,
  "club.social": SOCIAL_DEFAULT,
  "club.facts": FACTS_DEFAULT,
  "club.rating": RATING_DEFAULT,
  "club.paymentMarks": PAYMENT_MARKS_DEFAULT,
  "club.hours": HOURS_DEFAULT,
  "home.sections": SECTIONS_DEFAULT,
  "home.faq": FAQ_DEFAULT,
  "home.facilities": FACILITIES_DEFAULT,
  "home.testimonials": TESTIMONIALS_DEFAULT,
  "site.announcement": ANNOUNCEMENT_DEFAULT,
  "legal.terms": TERMS_DEFAULT,
  "legal.returns": RETURNS_DEFAULT,
  "page.location": LOCATION_DEFAULT,
  "program.personalTraining": PERSONAL_TRAINING_DEFAULT,
  "program.rehab": REHAB_DEFAULT,
  "program.swimming": SWIMMING_DEFAULT,
};
