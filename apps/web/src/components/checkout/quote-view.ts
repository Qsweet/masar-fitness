import type { PlanAddonOption } from "@masar/db";
import type { Quote } from "@masar/domain";
import { defaultDictionary } from "@/i18n/dictionaries";
import { moneyParts, type MoneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import {
  startRuleText,
  toDiscountView,
  toLineView,
  toTotalsView,
  type DiscountView,
  type LineView,
  type TotalsView,
} from "./checkout-view";
import { errorText } from "./error-text";

/** الكوبون المقيَّد بجمهور لا يُحسم قبل الجوال: رسالة إعلامية لا تمنع الطلب. */
const UNVERIFIED = "promotion.audience_unverified";

export interface QuoteView {
  readonly lines: readonly LineView[];
  readonly discounts: readonly DiscountView[];
  readonly totals: TotalsView;
  readonly startRule: string | undefined;
  /** ملاحظات تُذكر قبل الإرسال: الكوبون الذي غلبه عرض أوفر، والأهلية التي تُتحقق عند التأكيد. */
  readonly notes: readonly string[];
}

export interface CouponMessage {
  readonly text: string;
  /** خطأ نهائي: لا طلب حتى يُزال الكوبون أو يُصحَّح. */
  readonly blocking: boolean;
}

export interface AddonChoice {
  readonly slug: string;
  readonly name: string;
  readonly price: MoneyParts;
  readonly checked: boolean;
}

function quoteNotes(quote: Quote, locale: Locale): string[] {
  const { couponNotCombinable, eligibilityAtConfirm } = defaultDictionary(locale).checkout.summary;
  const notes: string[] = [];
  if (quote.couponOutcome.kind === "not_combinable") {
    notes.push(couponNotCombinable);
  }
  if (quote.rejectedAutomatic.some((rejected) => rejected.reason === UNVERIFIED)) {
    notes.push(eligibilityAtConfirm);
  }
  return notes;
}

/** ملخص الطلب قبل الجوال: السطور بسعر القائمة، ثم الخصومات بأسمائها، ثم الإجمالي وضريبته. */
export function toQuoteView(quote: Quote, locale: Locale): QuoteView {
  return {
    lines: quote.lines.map((line) => toLineView(line, locale)),
    discounts: quote.discounts.map((discount) => toDiscountView(discount, locale)),
    totals: toTotalsView({ ...quote, vatRateBps: quote.vatRate }, locale),
    startRule: startRuleText(quote.membershipStartRule, locale),
    notes: quoteNotes(quote, locale),
  };
}

/** رسالة حقل الكوبون، أو غائبة إن لم يكن فيه خطأ. */
export function couponMessage(quote: Quote, locale: Locale): CouponMessage | undefined {
  const error = quote.couponError;
  if (error === null) {
    return undefined;
  }
  return {
    text: errorText(error.reason, { checkout: defaultDictionary(locale).checkout }),
    blocking: error.reason !== UNVERIFIED,
  };
}

/** خانات الإضافات بسعر القائمة، والمختار منها معلَّم. */
export function addonChoices(
  addons: readonly PlanAddonOption[],
  selected: readonly string[],
  locale: Locale,
): AddonChoice[] {
  return addons.map((addon) => ({
    slug: addon.slug,
    name: addon.name[locale],
    price: moneyParts(addon.listPrice, locale),
    checked: selected.includes(addon.slug),
  }));
}
