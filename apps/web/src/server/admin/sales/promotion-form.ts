import type { PromotionAdminRow } from "@masar/db";
import { formatZonedDateTime, type PromotionDraftInput } from "@masar/domain";
import { moneyParts } from "@/i18n/format";
import type { FormValues } from "../field-form";

/**
 * حقول نموذج العرض: أسماؤها وأقصى أطوالها، وتحويلها من وإلى مدخل المجال. منطق صرف بلا خادم. القواعد
 * (شكل الرمز، مدى النسبة، ترتيب النافذة) في `@masar/domain`.
 */
const TEXT_INPUT_LENGTH = 400;
const SHORT_INPUT_LENGTH = 64;
/** معرّفات منتجات النطاق مفصولة بفاصلة: خمسون معرّفًا على الأكثر في المجال. */
const IDS_INPUT_LENGTH = 4_000;
const PERCENT_SCALE = 100;

export const PROMOTION_LIMITS_INPUT: Readonly<Record<string, number>> = {
  type: SHORT_INPUT_LENGTH,
  code: SHORT_INPUT_LENGTH,
  nameAr: TEXT_INPUT_LENGTH,
  nameEn: TEXT_INPUT_LENGTH,
  discountKind: SHORT_INPUT_LENGTH,
  percent: SHORT_INPUT_LENGTH,
  amount: SHORT_INPUT_LENGTH,
  scope: SHORT_INPUT_LENGTH,
  startsAt: SHORT_INPUT_LENGTH,
  endsAt: SHORT_INPUT_LENGTH,
  maxRedemptions: SHORT_INPUT_LENGTH,
  maxPerCustomer: SHORT_INPUT_LENGTH,
  stackable: SHORT_INPUT_LENGTH,
  audience: SHORT_INPUT_LENGTH,
};

export const PRODUCT_IDS_FIELD = "productIds";
const CHECKED = "on";

/** قيم النموذج كلها: الحقول النصية، وخانات المنتجات مجموعةً في حقل واحد بفواصل. */
export function promotionValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, maxLength] of Object.entries(PROMOTION_LIMITS_INPUT)) {
    const value = formData.get(name);
    values[name] = typeof value === "string" && value.length <= maxLength ? value : "";
  }
  const ids = formData
    .getAll(PRODUCT_IDS_FIELD)
    .filter((value): value is string => typeof value === "string")
    .join(",");
  values[PRODUCT_IDS_FIELD] = ids.length <= IDS_INPUT_LENGTH ? ids : "";
  return values;
}

function field(values: FormValues, name: string): string {
  return Object.hasOwn(values, name) ? (values[name] ?? "") : "";
}

export function selectedProductIds(values: FormValues): string[] {
  return field(values, PRODUCT_IDS_FIELD)
    .split(",")
    .filter((id) => id !== "");
}

export function promotionInput(values: FormValues): PromotionDraftInput {
  return {
    type: field(values, "type"),
    code: field(values, "code"),
    nameAr: field(values, "nameAr"),
    nameEn: field(values, "nameEn"),
    discountKind: field(values, "discountKind"),
    percent: field(values, "percent"),
    amount: field(values, "amount"),
    scope: field(values, "scope"),
    productIds: selectedProductIds(values),
    startsAt: field(values, "startsAt"),
    endsAt: field(values, "endsAt"),
    maxRedemptions: field(values, "maxRedemptions"),
    maxPerCustomer: field(values, "maxPerCustomer"),
    stackable: field(values, "stackable") === CHECKED,
    audience: field(values, "audience"),
  };
}

/** نقاط الأساس كما تُكتب نسبةً في الحقل: «10» أو «12.5». */
export function percentInput(bps: number): string {
  const whole = Math.trunc(bps / PERCENT_SCALE);
  const fraction = String(bps % PERCENT_SCALE)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${String(whole)}.${fraction}`;
}

/** قيم نموذج عرض جديد: كوبون بنسبة لكل المنتجات يبدأ الآن، وبلا قيم مقترحة للخصم ولا للحدود. */
export function emptyPromotionValues(now: Date, timeZone: string): Record<string, string> {
  return {
    type: "coupon",
    code: "",
    nameAr: "",
    nameEn: "",
    discountKind: "percentage",
    percent: "",
    amount: "",
    scope: "all_products",
    [PRODUCT_IDS_FIELD]: "",
    startsAt: formatZonedDateTime(now, timeZone),
    endsAt: "",
    maxRedemptions: "",
    maxPerCustomer: "",
    stackable: "",
    audience: "anyone",
  };
}

/** قيم النموذج من عرض قائم، بتوقيت النادي. */
export function promotionFormValues(
  row: PromotionAdminRow,
  timeZone: string,
): Record<string, string> {
  const { rule } = row;
  const { discount } = rule;
  return {
    type: rule.code === null ? "automatic" : "coupon",
    code: rule.code ?? "",
    nameAr: rule.name.ar,
    nameEn: rule.name.en,
    discountKind: discount.kind,
    percent: discount.kind === "percentage" ? percentInput(discount.rate) : "",
    amount: discount.kind === "fixed_amount" ? moneyParts(discount.amount, "en").amount : "",
    scope: rule.scope.kind,
    [PRODUCT_IDS_FIELD]:
      rule.scope.kind === "listed_products" ? rule.scope.productIds.join(",") : "",
    startsAt: formatZonedDateTime(rule.startsAt, timeZone),
    endsAt: rule.endsAt === null ? "" : formatZonedDateTime(rule.endsAt, timeZone),
    maxRedemptions: rule.maxRedemptions === null ? "" : String(rule.maxRedemptions),
    maxPerCustomer:
      rule.maxRedemptionsPerCustomer === null ? "" : String(rule.maxRedemptionsPerCustomer),
    stackable: rule.stackable ? CHECKED : "",
    audience: rule.audience,
  };
}

/** نسخة من عرض: الحقول نفسها بلا رمزه (الرمز لا يُستعمل مرتين)، وتبدأ الآن. */
export function copiedPromotionValues(
  row: PromotionAdminRow,
  now: Date,
  timeZone: string,
): Record<string, string> {
  return {
    ...promotionFormValues(row, timeZone),
    code: "",
    audience: "anyone",
    startsAt: formatZonedDateTime(now, timeZone),
    endsAt: "",
  };
}
