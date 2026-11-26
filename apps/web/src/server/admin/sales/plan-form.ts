import type { CatalogProductDetail } from "@masar/db";
import {
  PRODUCT_LIMITS,
  type BenefitInput,
  type ProductDraftInput,
  type ProductIdentityInput,
  type ProductTermsInput,
} from "@masar/domain";
import { moneyParts } from "@/i18n/format";
import type { FormValues } from "../field-form";

/**
 * حقول نماذج المنتج: أسماؤها وأقصى أطوالها قبل أي معالجة، وتحويلها من وإلى مدخلات المجال. منطق صرف
 * بلا خادم، فيُختبر مستقلًا ويستورده مكوّن النموذج. القواعد نفسها (الأطوال المقبولة، المدة، السعر) في
 * `@masar/domain`؛ الحدود هنا أوسع عمدًا ليصل الزائد إلى المجال فيُرفض برسالته.
 */
const TEXT_INPUT_LENGTH = 400;
const NUMBER_INPUT_LENGTH = 32;
const CODE_INPUT_LENGTH = 100;

export const BENEFIT_ROWS = PRODUCT_LIMITS.benefitsMax;
/** صفوف المزايا الفارغة الزائدة التي يرسمها النموذج بلا JavaScript. */
export const SPARE_BENEFIT_ROWS = 2;
export const MIN_BENEFIT_ROWS = 3;

export const IDENTITY_LIMITS = {
  nameAr: TEXT_INPUT_LENGTH,
  nameEn: TEXT_INPUT_LENGTH,
  summaryAr: TEXT_INPUT_LENGTH,
  summaryEn: TEXT_INPUT_LENGTH,
  tierAr: TEXT_INPUT_LENGTH,
  tierEn: TEXT_INPUT_LENGTH,
  sortOrder: NUMBER_INPUT_LENGTH,
} as const;

export function benefitField(part: "ar" | "en" | "order", index: number): string {
  return `benefit_${part}_${String(index)}`;
}

function benefitLimits(): Record<string, number> {
  const limits: Record<string, number> = {};
  for (let index = 0; index < BENEFIT_ROWS; index += 1) {
    limits[benefitField("ar", index)] = TEXT_INPUT_LENGTH;
    limits[benefitField("en", index)] = TEXT_INPUT_LENGTH;
    limits[benefitField("order", index)] = NUMBER_INPUT_LENGTH;
  }
  return limits;
}

export const TERMS_LIMITS: Readonly<Record<string, number>> = {
  price: NUMBER_INPUT_LENGTH,
  durationMonths: NUMBER_INPUT_LENGTH,
  bonusMonths: NUMBER_INPUT_LENGTH,
  ...benefitLimits(),
};

export const CREATE_LIMITS: Readonly<Record<string, number>> = {
  kind: CODE_INPUT_LENGTH,
  slug: CODE_INPUT_LENGTH,
  ...IDENTITY_LIMITS,
  ...TERMS_LIMITS,
};

function field(values: FormValues, name: string): string {
  return Object.hasOwn(values, name) ? (values[name] ?? "") : "";
}

function benefitInputs(values: FormValues): BenefitInput[] {
  return Array.from({ length: BENEFIT_ROWS }, (_, index) => ({
    ar: field(values, benefitField("ar", index)),
    en: field(values, benefitField("en", index)),
    sortOrder: field(values, benefitField("order", index)),
  }));
}

export function identityInput(values: FormValues): ProductIdentityInput {
  return {
    nameAr: field(values, "nameAr"),
    nameEn: field(values, "nameEn"),
    summaryAr: field(values, "summaryAr"),
    summaryEn: field(values, "summaryEn"),
    tierAr: field(values, "tierAr"),
    tierEn: field(values, "tierEn"),
    sortOrder: field(values, "sortOrder"),
  };
}

export function termsInput(values: FormValues): ProductTermsInput {
  return {
    price: field(values, "price"),
    durationMonths: field(values, "durationMonths"),
    bonusMonths: field(values, "bonusMonths"),
    benefits: benefitInputs(values),
  };
}

export function draftInput(values: FormValues): ProductDraftInput {
  return {
    kind: field(values, "kind"),
    slug: field(values, "slug"),
    ...identityInput(values),
    ...termsInput(values),
  };
}

/** خطأ صف ميزة يرجع من المجال باسم `benefit_<i>`: يُعرض تحت صفه. */
export function benefitErrorField(index: number): string {
  return `benefit_${String(index)}`;
}

/** قيم نموذج الهوية من المنتج القائم. */
export function identityValues(product: CatalogProductDetail): Record<string, string> {
  return {
    nameAr: product.name.ar,
    nameEn: product.name.en,
    summaryAr: product.summary.ar,
    summaryEn: product.summary.en,
    tierAr: product.tier?.ar ?? "",
    tierEn: product.tier?.en ?? "",
    sortOrder: String(product.sortOrder),
  };
}

/** قيم نموذج الشروط من النسخة السارية (فارغة إن لم توجد). السعر بالريال كما يُكتب. */
export function termsValues(product: CatalogProductDetail): Record<string, string> {
  const version = product.currentVersion;
  const values: Record<string, string> = {
    price: version === null ? "" : moneyParts(version.price, "en").amount,
    durationMonths: String(version?.durationMonths ?? ""),
    bonusMonths: version === null ? "" : String(version.bonusMonths),
  };
  for (const [index, benefit] of (version?.benefits ?? []).entries()) {
    values[benefitField("ar", index)] = benefit.ar;
    values[benefitField("en", index)] = benefit.en;
    values[benefitField("order", index)] = String(index + 1);
  }
  return values;
}

/** عدد صفوف المزايا التي يرسمها النموذج: المكتوب منها وصفّان فارغان، وثلاثة على الأقل. */
export function benefitRowCount(values: FormValues): number {
  let filled = 0;
  for (let index = 0; index < BENEFIT_ROWS; index += 1) {
    const written =
      field(values, benefitField("ar", index)) + field(values, benefitField("en", index));
    if (written.trim() !== "") {
      filled = index + 1;
    }
  }
  return Math.min(BENEFIT_ROWS, Math.max(MIN_BENEFIT_ROWS, filled + SPARE_BENEFIT_ROWS));
}
