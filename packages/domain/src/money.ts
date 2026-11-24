import { DomainError } from "./errors";

/** العملات المدعومة. إضافة عملة قرار عمل، لا تغيير عابر. */
export const CURRENCIES = ["SAR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/**
 * مبلغ مالي بالوحدة الصغرى (هللة) كعدد صحيح. لا كسور عشرية في أي حساب مالي.
 * يُبنى عبر `money()` فقط ليضمن صحة القيمة.
 */
declare const moneyBrand: unique symbol;

export interface Money {
  readonly amountMinor: number;
  readonly currency: Currency;
  /** علامة نوع فقط: تمنع بناء المبلغ بكائن حرفي يتجاوز فحوص `money()`. */
  readonly [moneyBrand]: true;
}

function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/**
 * المدخل الوحيد لبناء مبلغ. `currency` نص عام لأن القيم تصل من القاعدة والمزوّدين.
 * المبلغ السالب مسموح (فرق الاسترداد)؛ من يشترط الموجب يفحصه في موضعه.
 */
export function money(amountMinor: number, currency = "SAR"): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new DomainError("invariant", "money.not_safe_integer");
  }
  if (!isCurrency(currency)) {
    throw new DomainError("invariant", "money.unsupported_currency");
  }
  // `+ 0` يحوّل الصفر السالب إلى صفر عادي
  return Object.freeze({ amountMinor: amountMinor + 0, currency }) as Money;
}

/**
 * رمز العملة كنص عام: المقارنة تبقى فحصًا فعليًا وقت التشغيل حتى والنوع اليوم عملة واحدة،
 * لأن القيم تصل من قاعدة البيانات ومن المزوّدين لا من الكود وحده.
 */
function currencyCode(value: Money): string {
  return value.currency;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (currencyCode(a) !== currencyCode(b)) {
    throw new DomainError("invariant", "money.currency_mismatch");
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function moneyEquals(a: Money, b: Money): boolean {
  return currencyCode(a) === currencyCode(b) && a.amountMinor === b.amountMinor;
}
