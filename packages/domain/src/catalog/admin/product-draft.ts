import { MAX_AMOUNT_MINOR } from "../../commerce/pricing/limits";
import { IssueList, parseWholeNumber, singleLine, type Validated } from "../../field-input";
import { err, ok } from "../../result";
import { parseSarAmount } from "../../sar-amount";
import type { LocalizedText } from "../membership-plan";

/** ما يُنشأ ويُعدَّل من اللوحة: الاشتراك والإضافة. البرنامج الرقمي والخدمة بتقييم قراءة فقط. */
export const PRODUCT_ADMIN_KINDS = ["membership", "addon"] as const;
export type ProductAdminKind = (typeof PRODUCT_ADMIN_KINDS)[number];

export function isProductAdminKind(value: unknown): value is ProductAdminKind {
  return PRODUCT_ADMIN_KINDS.some((kind) => kind === value);
}

/**
 * حدود إدخال تقنية (لا قواعد عمل): أطوال النصوص، وأقصى مدة وأشهر مجانية يقبلها النموذج، وعدد المزايا.
 * `slugMax` يطابق قيد `products_slug_shape`.
 */
export const PRODUCT_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  summaryMax: 200,
  tierMax: 60,
  slugMax: 80,
  durationMax: 36,
  bonusMax: 12,
  benefitsMax: 12,
  benefitMax: 120,
  sortOrderMax: 9999,
} as const;

/** نمط `products_slug_shape`: حروف لاتينية صغيرة وأرقام وشرطات مفردة. */
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface ProductIdentityInput {
  readonly nameAr: string;
  readonly nameEn: string;
  readonly summaryAr: string;
  readonly summaryEn: string;
  readonly tierAr: string;
  readonly tierEn: string;
  readonly sortOrder: string;
}

export interface ProductIdentity {
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  /** اسم الفئة التسويقي؛ للاشتراك فقط، وباللغتين معًا أو لا شيء. */
  readonly tier: LocalizedText | null;
  readonly sortOrder: number;
}

export interface BenefitInput {
  readonly ar: string;
  readonly en: string;
  /** رقم الترتيب كما كُتب؛ الفارغ يأخذ موضع الصف. */
  readonly sortOrder: string;
}

export interface ProductTermsInput {
  readonly price: string;
  readonly durationMonths: string;
  readonly bonusMonths: string;
  readonly benefits: readonly BenefitInput[];
}

export interface ProductTerms {
  /** بالهللة، شامل الضريبة. */
  readonly priceMinor: number;
  /** null للإضافة: لا مدة لها. */
  readonly durationMonths: number | null;
  readonly bonusMonths: number;
  /** بترتيب العرض. */
  readonly benefits: readonly LocalizedText[];
}

function checkName(issues: IssueList, field: string, value: string): void {
  if (value.length < PRODUCT_LIMITS.nameMin || value.length > PRODUCT_LIMITS.nameMax) {
    issues.add(field, "catalog.name_length");
  }
}

function checkSummary(issues: IssueList, field: string, value: string): void {
  if (value.length > PRODUCT_LIMITS.summaryMax) {
    issues.add(field, "catalog.summary_too_long");
  }
}

function parseTier(
  issues: IssueList,
  kind: ProductAdminKind,
  input: ProductIdentityInput,
): LocalizedText | null {
  const ar = singleLine(input.tierAr);
  const en = singleLine(input.tierEn);
  if (kind !== "membership" || (ar === "" && en === "")) {
    return null;
  }
  if (ar === "" || en === "") {
    issues.add(ar === "" ? "tierAr" : "tierEn", "catalog.tier_both_languages");
  }
  for (const [field, value] of [
    ["tierAr", ar],
    ["tierEn", en],
  ] as const) {
    if (value.length > PRODUCT_LIMITS.tierMax) {
      issues.add(field, "catalog.tier_too_long");
    }
  }
  return { ar, en };
}

function parseSortOrder(issues: IssueList, text: string): number {
  const value = singleLine(text) === "" ? 0 : parseWholeNumber(text);
  if (value === null || value > PRODUCT_LIMITS.sortOrderMax) {
    issues.add("sortOrder", "catalog.sort_order_invalid");
    return 0;
  }
  return value;
}

function readIdentity(
  issues: IssueList,
  kind: ProductAdminKind,
  input: ProductIdentityInput,
): ProductIdentity {
  const name = { ar: singleLine(input.nameAr), en: singleLine(input.nameEn) };
  const summary = { ar: singleLine(input.summaryAr), en: singleLine(input.summaryEn) };
  checkName(issues, "nameAr", name.ar);
  checkName(issues, "nameEn", name.en);
  checkSummary(issues, "summaryAr", summary.ar);
  checkSummary(issues, "summaryEn", summary.en);
  return {
    name,
    summary,
    tier: parseTier(issues, kind, input),
    sortOrder: parseSortOrder(issues, input.sortOrder),
  };
}

/** هوية المنتج: الاسمان 2 إلى 80، والملخصان حتى 200، واسم الفئة باللغتين أو لا شيء، والترتيب رقم. */
export function validateProductIdentity(
  kind: ProductAdminKind,
  input: ProductIdentityInput,
): Validated<ProductIdentity> {
  const issues = new IssueList();
  const identity = readIdentity(issues, kind, input);
  return issues.empty ? ok(identity) : err(issues.all);
}

function parsePrice(issues: IssueList, text: string): number {
  const parsed = parseSarAmount(text);
  if (!parsed.ok) {
    issues.add("price", parsed.error.reason);
    return 0;
  }
  if (parsed.value <= 0 || parsed.value > MAX_AMOUNT_MINOR) {
    issues.add("price", "catalog.price_not_positive");
  }
  return parsed.value;
}

function parseMonths(
  issues: IssueList,
  field: "durationMonths" | "bonusMonths",
  text: string,
  range: { readonly min: number; readonly max: number },
): number {
  const value = parseWholeNumber(text);
  if (value === null || value < range.min || value > range.max) {
    issues.add(field, `catalog.${field === "durationMonths" ? "duration" : "bonus"}_out_of_range`);
    return range.min;
  }
  return value;
}

interface OrderedBenefit {
  readonly label: LocalizedText;
  readonly order: number;
  readonly index: number;
}

function readBenefit(issues: IssueList, row: BenefitInput, index: number): OrderedBenefit | null {
  const label = { ar: singleLine(row.ar), en: singleLine(row.en) };
  if (label.ar === "" && label.en === "") {
    return null;
  }
  const field = `benefit_${String(index)}`;
  if (label.ar === "" || label.en === "") {
    issues.add(field, "catalog.benefit_both_languages");
  } else if (Math.max(label.ar.length, label.en.length) > PRODUCT_LIMITS.benefitMax) {
    issues.add(field, "catalog.benefit_too_long");
  }
  const order = singleLine(row.sortOrder) === "" ? index : parseWholeNumber(row.sortOrder);
  if (order === null) {
    issues.add(field, "catalog.sort_order_invalid");
  }
  return { label, order: order ?? index, index };
}

/** الصفوف الفارغة تُهمل، والباقي بترتيب رقمه ثم موضعه في النموذج. */
function parseBenefits(issues: IssueList, rows: readonly BenefitInput[]): LocalizedText[] {
  const benefits = rows
    .map((row, index) => readBenefit(issues, row, index))
    .filter((benefit) => benefit !== null);
  if (benefits.length > PRODUCT_LIMITS.benefitsMax) {
    issues.add("benefits", "catalog.too_many_benefits");
  }
  return benefits
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((benefit) => benefit.label);
}

function readTerms(
  issues: IssueList,
  kind: ProductAdminKind,
  input: ProductTermsInput,
): ProductTerms {
  const membership = kind === "membership";
  return {
    priceMinor: parsePrice(issues, input.price),
    durationMonths: membership
      ? parseMonths(issues, "durationMonths", input.durationMonths, {
          min: 1,
          max: PRODUCT_LIMITS.durationMax,
        })
      : null,
    bonusMonths: membership
      ? parseMonths(issues, "bonusMonths", input.bonusMonths === "" ? "0" : input.bonusMonths, {
          min: 0,
          max: PRODUCT_LIMITS.bonusMax,
        })
      : 0,
    benefits: parseBenefits(issues, input.benefits),
  };
}

/**
 * شروط النسخة: السعر بالريال شامل الضريبة (موجب)، والمدة والأشهر المجانية للاشتراك وحده، والمزايا حتى
 * 12 وكل ميزة باللغتين. السعر يمر بـ`parseSarAmount`: لا كسر عشري في أي حساب.
 */
export function validateProductTerms(
  kind: ProductAdminKind,
  input: ProductTermsInput,
): Validated<ProductTerms> {
  const issues = new IssueList();
  const terms = readTerms(issues, kind, input);
  return issues.empty ? ok(terms) : err(issues.all);
}

export interface ProductDraftInput extends ProductIdentityInput, ProductTermsInput {
  readonly kind: string;
  readonly slug: string;
}

export interface ProductDraft {
  readonly kind: ProductAdminKind;
  readonly slug: string;
  readonly identity: ProductIdentity;
  readonly terms: ProductTerms;
}

function parseSlug(issues: IssueList, text: string): string {
  const slug = singleLine(text).toLowerCase();
  if (slug.length > PRODUCT_LIMITS.slugMax || !SLUG_SHAPE.test(slug)) {
    issues.add("slug", "catalog.slug_invalid");
  }
  return slug;
}

/** منتج جديد كاملًا: النوع والمعرّف النصي (يُكتبان مرة واحدة) مع الهوية وشروط النسخة الأولى. */
export function validateProductDraft(input: ProductDraftInput): Validated<ProductDraft> {
  if (!isProductAdminKind(input.kind)) {
    return err([{ field: "kind", reason: "catalog.kind_invalid" }]);
  }
  const issues = new IssueList();
  const draft: ProductDraft = {
    kind: input.kind,
    slug: parseSlug(issues, input.slug),
    identity: readIdentity(issues, input.kind, input),
    terms: readTerms(issues, input.kind, input),
  };
  return issues.empty ? ok(draft) : err(issues.all);
}
