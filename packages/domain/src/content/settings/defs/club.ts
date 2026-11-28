import type { SettingIssue } from "../check";
import { bool, localized, text, url, type ShapeValue } from "../spec";

/**
 * بيانات النادي المنظَّمة (ADMIN_A3_CONTENT §5.1، WP6): التواصل والعنوان، والحسابات، والحقائق والسجلات،
 * وتقييم Google، وشعارات الدفع. كلها بصلاحية `content.facts`: خطأ فيها يدّعي أو يضلّل.
 */
const PHONE_MAX = 20;
const EMAIL_MAX = 254;
const STREET_MAX = 120;
const LOCALITY_MAX = 40;
const POSTAL_DIGITS = 5;
const COORDINATE_MAX = 12;
const PLUS_CODE_MAX = 12;
/** ملف Google الرسمي ورابط الاتجاهات: خرائط Google وحدها. */
export const MAP_HOSTS = ["maps.app.goo.gl", "www.google.com", "maps.google.com"] as const;

export const CONTACT_SHAPE = {
  phone: text("phone", PHONE_MAX, true),
  whatsapp: text("mobile", PHONE_MAX, true),
  email: text("email", EMAIL_MAX),
  street: localized(STREET_MAX, "both"),
  locality: localized(LOCALITY_MAX, "both"),
  postalCode: text("digits", POSTAL_DIGITS, true),
  latitude: text("decimal", COORDINATE_MAX, true),
  longitude: text("decimal", COORDINATE_MAX, true),
  mapUrl: url(MAP_HOSTS, true),
  directionsUrl: url(MAP_HOSTS),
  plusCode: text("plusCode", PLUS_CODE_MAX),
};
export type ContactSetting = ShapeValue<typeof CONTACT_SHAPE>;

/** حدود المملكة التقريبية: إحداثي خارجها خطأ إدخال. */
const KSA_BOUNDS = { south: 16, north: 33, west: 34, east: 56 } as const;

function within(value: string, min: number, max: number): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export function checkContact(value: ContactSetting): SettingIssue[] {
  const issues: SettingIssue[] = [];
  if (!within(value.latitude, KSA_BOUNDS.south, KSA_BOUNDS.north)) {
    issues.push({ field: "latitude", reason: "settings.coordinate_range" });
  }
  if (!within(value.longitude, KSA_BOUNDS.west, KSA_BOUNDS.east)) {
    issues.push({ field: "longitude", reason: "settings.coordinate_range" });
  }
  if (value.postalCode.length !== POSTAL_DIGITS) {
    issues.push({ field: "postalCode", reason: "settings.format_digits" });
  }
  return issues;
}

/** لكل حساب مضيف واحد مسموح؛ الفارغ لا يُعرض. الترتيب ترتيب العرض. */
export const SOCIAL_SHAPE = {
  instagram: url(["www.instagram.com"]),
  x: url(["x.com"]),
  snapchat: url(["www.snapchat.com"]),
  tiktok: url(["www.tiktok.com"]),
};
export type SocialSetting = ShapeValue<typeof SOCIAL_SHAPE>;
export const SOCIAL_IDS = ["instagram", "x", "snapchat", "tiktok"] as const;
export type SocialId = (typeof SOCIAL_IDS)[number];

const YEAR_DIGITS = 4;
const MACHINES_DIGITS = 4;
const REGISTRATION_DIGITS = 10;
const VAT_DIGITS = 15;

/** الحقائق والسجلات: الرقم يُحفظ ولا يُعرض حتى يُفعَّل مفتاح عرضه (القرار 50). */
export const FACTS_SHAPE = {
  foundedYear: text("year", YEAR_DIGITS, true),
  machinesOver: text("int", MACHINES_DIGITS),
  commercialRegistration: text("digits", REGISTRATION_DIGITS),
  showCommercialRegistration: bool(),
  vatNumber: text("digits", VAT_DIGITS),
  showVatNumber: bool(),
};
export type FactsSetting = ShapeValue<typeof FACTS_SHAPE>;

export function checkFacts(value: FactsSetting): SettingIssue[] {
  const issues: SettingIssue[] = [];
  if (value.showCommercialRegistration && value.commercialRegistration === "") {
    issues.push({ field: "showCommercialRegistration", reason: "settings.show_needs_value" });
  }
  if (value.showVatNumber && value.vatNumber === "") {
    issues.push({ field: "showVatNumber", reason: "settings.show_needs_value" });
  }
  if (value.vatNumber !== "" && value.vatNumber.length !== VAT_DIGITS) {
    issues.push({ field: "vatNumber", reason: "settings.vat_length" });
  }
  return issues;
}

const RATING_MAX = 3;
const COUNT_DIGITS = 7;
const DATE_MAX = 10;

/** تقييم Google: لا يُعرض إلا بقيمته وعدد مراجعاته وتاريخ قراءته معًا. */
export const RATING_SHAPE = {
  show: bool(),
  value: text("rating", RATING_MAX),
  count: text("int", COUNT_DIGITS),
  asOf: text("date", DATE_MAX),
};
export type RatingSetting = ShapeValue<typeof RATING_SHAPE>;

export function checkRating(value: RatingSetting): SettingIssue[] {
  if (!value.show) {
    return [];
  }
  return (["value", "count", "asOf"] as const)
    .filter((field) => value[field] === "")
    .map((field) => ({ field, reason: "settings.required" }));
}

/** القائمة المغلقة لطرق الدفع المعروضة؛ الترتيب ترتيب العرض. */
export const PAYMENT_MARK_IDS = ["mada", "applePay", "stcPay", "tabby", "tamara", "bank"] as const;
export type PaymentMarkId = (typeof PAYMENT_MARK_IDS)[number];
export const PAYMENT_MARKS_SHAPE = {
  mada: bool(),
  applePay: bool(),
  stcPay: bool(),
  tabby: bool(),
  tamara: bool(),
  bank: bool(),
};
export type PaymentMarksSetting = ShapeValue<typeof PAYMENT_MARKS_SHAPE>;
