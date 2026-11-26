import type { LocalizedText } from "../catalog/membership-plan";
import { parseCouponCode, type CouponCode } from "../commerce/pricing/coupon-code";
import { BASIS_POINTS_SCALE } from "../commerce/pricing/limits";
import type { PromotionDiscount, PromotionScope } from "../commerce/pricing/promotion";
import { basisPoints } from "../commerce/pricing/vat";
import { IssueList, parseWholeNumber, singleLine, type Validated } from "../field-input";
import { money, type Currency } from "../money";
import { err, ok } from "../result";
import { parseSarAmount } from "../sar-amount";
import { parseZonedDateTime } from "../zoned-time";

export const PROMOTION_TYPES = ["automatic", "coupon"] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const DISCOUNT_KINDS = ["percentage", "fixed_amount"] as const;
export const PROMOTION_SCOPE_KINDS = ["all_products", "listed_products"] as const;

/** حدود إدخال تقنية: طول الاسم، وعدد منتجات النطاق، وأكبر حد استخدام يقبله النموذج. */
export const PROMOTION_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  maxProducts: 50,
  maxRedemptions: 1_000_000,
} as const;

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface PromotionDraftInput {
  readonly type: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly discountKind: string;
  /** النسبة كما تُكتب: «10» أو «12.5». */
  readonly percent: string;
  /** المبلغ بالريال. */
  readonly amount: string;
  readonly scope: string;
  readonly productIds: readonly string[];
  /** وقت محلي بمنطقة النادي (`YYYY-MM-DDTHH:mm`). */
  readonly startsAt: string;
  readonly endsAt: string;
  readonly maxRedemptions: string;
  readonly maxPerCustomer: string;
  readonly stackable: boolean;
  readonly audience: string;
}

export interface PromotionDraft {
  readonly code: CouponCode | null;
  readonly name: LocalizedText;
  readonly discount: PromotionDiscount;
  readonly scope: PromotionScope;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly maxRedemptions: number | null;
  readonly maxRedemptionsPerCustomer: number | null;
  readonly stackable: boolean;
  /** الجمهور المقيَّد محجوب بقرار مالك (تعريف «العميل الجديد»): `anyone` وحده يُنشأ من اللوحة. */
  readonly audience: "anyone";
}

export interface PromotionDraftContext {
  readonly currency: Currency;
  readonly timeZone: string;
}

function parseCode(issues: IssueList, input: PromotionDraftInput): CouponCode | null {
  if (input.type === "automatic") {
    return null;
  }
  if (input.type !== "coupon") {
    issues.add("type", "promotion.type_invalid");
    return null;
  }
  const parsed = parseCouponCode(input.code);
  if (!parsed.ok || parsed.value === null) {
    issues.add("code", "promotion.code_invalid");
    return null;
  }
  return parsed.value;
}

function parseName(issues: IssueList, field: string, text: string): string {
  const value = singleLine(text);
  if (value.length < PROMOTION_LIMITS.nameMin || value.length > PROMOTION_LIMITS.nameMax) {
    issues.add(field, "promotion.name_length");
  }
  return value;
}

/** نسبة بخانتين عشريتين على الأكثر ← نقاط أساس (0.01% = نقطة واحدة). التحليل نفسه للمبالغ: بلا كسر عشري. */
function parsePercent(issues: IssueList, text: string): PromotionDiscount {
  const parsed = parseSarAmount(singleLine(text).replace(/[%٪]$/u, ""));
  const inRange = parsed.ok && parsed.value >= 1 && parsed.value <= BASIS_POINTS_SCALE;
  if (!inRange) {
    issues.add("percent", "promotion.percent_invalid");
  }
  return { kind: "percentage", rate: basisPoints(inRange ? parsed.value : 1) };
}

function parseAmount(issues: IssueList, text: string, currency: Currency): PromotionDiscount {
  const parsed = parseSarAmount(text);
  if (!parsed.ok) {
    issues.add("amount", parsed.error.reason);
  } else if (parsed.value <= 0) {
    issues.add("amount", "promotion.amount_not_positive");
  }
  return { kind: "fixed_amount", amount: money(parsed.ok ? parsed.value : 0, currency) };
}

function parseDiscount(
  issues: IssueList,
  input: PromotionDraftInput,
  currency: Currency,
): PromotionDiscount {
  if (input.discountKind === "fixed_amount") {
    return parseAmount(issues, input.amount, currency);
  }
  if (input.discountKind !== "percentage") {
    issues.add("discountKind", "promotion.discount_kind_invalid");
  }
  return parsePercent(issues, input.percent);
}

function parseScope(issues: IssueList, input: PromotionDraftInput): PromotionScope {
  if (input.scope === "all_products") {
    return { kind: "all_products" };
  }
  const productIds = [...new Set(input.productIds)].sort();
  const valid =
    input.scope === "listed_products" &&
    productIds.length > 0 &&
    productIds.length <= PROMOTION_LIMITS.maxProducts &&
    productIds.every((id) => UUID_SHAPE.test(id));
  if (!valid) {
    issues.add(
      "scope",
      input.scope === "listed_products" ? "promotion.products_required" : "promotion.scope_invalid",
    );
  }
  return { kind: "listed_products", productIds };
}

function parseWindow(
  issues: IssueList,
  input: PromotionDraftInput,
  timeZone: string,
): { startsAt: Date; endsAt: Date | null } {
  const starts = parseZonedDateTime(input.startsAt, timeZone);
  if (!starts.ok) {
    issues.add("startsAt", "promotion.starts_at_invalid");
  }
  const startsAt = starts.ok ? starts.value : new Date(0);
  if (input.endsAt.trim() === "") {
    return { startsAt, endsAt: null };
  }
  const ends = parseZonedDateTime(input.endsAt, timeZone);
  if (!ends.ok) {
    issues.add("endsAt", "promotion.ends_at_invalid");
    return { startsAt, endsAt: null };
  }
  if (ends.value.getTime() <= startsAt.getTime()) {
    issues.add("endsAt", "promotion.window_not_ordered");
  }
  return { startsAt, endsAt: ends.value };
}

function parseLimit(issues: IssueList, field: string, text: string): number | null {
  if (singleLine(text) === "") {
    return null;
  }
  const value = parseWholeNumber(text);
  if (value === null || value < 1 || value > PROMOTION_LIMITS.maxRedemptions) {
    issues.add(field, "promotion.limit_invalid");
    return null;
  }
  return value;
}

/**
 * عرض أو كوبون كما يُحفظ. الرمز يمر بـ`parseCouponCode` نفسها التي تقرأ ما يكتبه العميل، والنسبة
 * والمبلغ بلا كسر عشري، والنافذة بتوقيت النادي، والجمهور `anyone` وحده.
 */
export function validatePromotionDraft(
  input: PromotionDraftInput,
  context: PromotionDraftContext,
): Validated<PromotionDraft> {
  const issues = new IssueList();
  if (input.audience !== "anyone") {
    issues.add("audience", "promotion.audience_restricted");
  }
  const draft: PromotionDraft = {
    code: parseCode(issues, input),
    name: {
      ar: parseName(issues, "nameAr", input.nameAr),
      en: parseName(issues, "nameEn", input.nameEn),
    },
    discount: parseDiscount(issues, input, context.currency),
    scope: parseScope(issues, input),
    ...parseWindow(issues, input, context.timeZone),
    maxRedemptions: parseLimit(issues, "maxRedemptions", input.maxRedemptions),
    maxRedemptionsPerCustomer: parseLimit(issues, "maxPerCustomer", input.maxPerCustomer),
    stackable: input.stackable,
    audience: "anyone",
  };
  return issues.empty ? ok(draft) : err(issues.all);
}
