import type { LocalizedText, MembershipStartRule, Money } from "@masar/domain";
import { durationText } from "@/components/plans/plan-view";
import { defaultDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { moneyParts, type MoneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

/**
 * أجزاء العرض المشتركة بين ملخص الشراء ومراجعة الطلب. كل نص ورقم يُحسب هنا على الخادم
 * من السطور المسعَّرة (لا يُحسب سعر في الواجهة)، والمكوّنات تعرض فقط.
 */

/** نسبة الضريبة بنقاط الأساس: 100 نقطة = 1%. للعرض فقط، لا حساب مالي. */
const BASIS_POINTS_PER_PERCENT = 100;
const MAX_RATE_DIGITS = 2;
/** الأرقام لاتينية في اللغتين (القرار 15). */
const NUMBER_LOCALE = "en-US";

/** سطر مسعَّر كما يأتي من عرض السعر أو من لقطة الطلب. */
export interface LineSource {
  readonly slug: string;
  readonly name: LocalizedText;
  readonly paidMonths: number | null;
  readonly bonusMonths: number;
  readonly listPrice: Money;
}

export interface LineView {
  readonly key: string;
  readonly name: string;
  /** المدة للاشتراك، وغائبة للإضافة. */
  readonly detail: string | undefined;
  readonly price: MoneyParts;
}

export interface DiscountSource {
  readonly code: string | null;
  readonly name: LocalizedText;
  readonly sequence: number;
  readonly amount: Money;
}

export interface DiscountView {
  readonly key: string;
  readonly name: string;
  /** «كوبون DEMO10» للكوبون، وغائب للعرض التلقائي. */
  readonly code: string | undefined;
  readonly amount: MoneyParts;
}

export interface TotalsSource {
  readonly subtotal: Money;
  readonly discount: Money;
  readonly total: Money;
  readonly vat: Money;
  readonly vatRateBps: number;
}

export interface TotalsView {
  readonly subtotal: MoneyParts;
  readonly discount: MoneyParts | undefined;
  readonly total: MoneyParts;
  readonly vatLabel: string;
  readonly vat: MoneyParts;
}

export function toLineView(line: LineSource, locale: Locale): LineView {
  return {
    key: line.slug,
    name: line.name[locale],
    detail:
      line.paidMonths === null
        ? undefined
        : durationText({ paidMonths: line.paidMonths, bonusMonths: line.bonusMonths }, locale),
    price: moneyParts(line.listPrice, locale),
  };
}

export function toDiscountView(discount: DiscountSource, locale: Locale): DiscountView {
  const { couponDiscount } = defaultDictionary(locale).checkout.summary;
  return {
    key: String(discount.sequence),
    name: discount.name[locale],
    code: discount.code === null ? undefined : fill(couponDiscount, { code: discount.code }),
    amount: moneyParts(discount.amount, locale),
  };
}

export function formatVatRate(vatRateBps: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: MAX_RATE_DIGITS }).format(
    vatRateBps / BASIS_POINTS_PER_PERCENT,
  );
}

export function toTotalsView(totals: TotalsSource, locale: Locale): TotalsView {
  const { vat } = defaultDictionary(locale).checkout.summary;
  return {
    subtotal: moneyParts(totals.subtotal, locale),
    discount: totals.discount.amountMinor > 0 ? moneyParts(totals.discount, locale) : undefined,
    total: moneyParts(totals.total, locale),
    vatLabel: fill(vat, { rate: formatVatRate(totals.vatRateBps) }),
    vat: moneyParts(totals.vat, locale),
  };
}

/** نص قاعدة بدء الاشتراك من القاموس، أو غائب لغير الاشتراك. */
export function startRuleText(
  rule: MembershipStartRule | null,
  locale: Locale,
): string | undefined {
  return rule === null ? undefined : defaultDictionary(locale).checkout.summary.startRule[rule];
}
