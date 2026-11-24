import type { Money } from "@masar/domain";
import { getDictionary } from "./dictionaries";
import type { Locale } from "./locales";

const MINOR_PER_MAJOR = 100;
const HALALA_DIGITS = 2;
const ARABIC_FEW_MAX = 10;
const DUAL = 2;

/** الأرقام لاتينية في اللغتين (العرف السائد في المتاجر السعودية) — القرار 15. */
const NUMBER_LOCALE = "en-US";

export interface MoneyParts {
  readonly amount: string;
  readonly unit: string;
}

/** المبلغ ووحدته منفصلين لتنسيق كل منهما. الهللات تظهر فقط إن وُجدت. */
export function moneyParts(value: Money, locale: Locale): MoneyParts {
  const hasHalalas = value.amountMinor % MINOR_PER_MAJOR !== 0;
  const amount = new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: hasHalalas ? HALALA_DIGITS : 0,
    maximumFractionDigits: HALALA_DIGITS,
  }).format(value.amountMinor / MINOR_PER_MAJOR);
  return { amount, unit: getDictionary(locale).currency[value.currency] };
}

export interface MonthsParts {
  /** العدد إن كان يُكتب رقمًا؛ فارغ حين تغني الكلمة عنه («شهر»، «شهران»). */
  readonly count: string | undefined;
  readonly unit: string;
}

/**
 * عدد الأشهر بصيغته الصحيحة. منطق اختيار الصيغة هنا والكلمات من القاموس:
 * العربية تفرّق بين المفرد والمثنى (بلا رقم) والجمع (3–10) وتمييز ما فوق العشرة؛ الإنجليزية مفرد وجمع.
 */
export function monthsParts(months: number, locale: Locale): MonthsParts {
  const words = getDictionary(locale).months;
  if (months === 1) {
    return { count: locale === "ar" ? undefined : String(months), unit: words.one };
  }
  if (months === DUAL) {
    return { count: locale === "ar" ? undefined : String(months), unit: words.two };
  }
  return { count: String(months), unit: months <= ARABIC_FEW_MAX ? words.few : words.many };
}

export function formatMonths(months: number, locale: Locale): string {
  const { count, unit } = monthsParts(months, locale);
  return count === undefined ? unit : `${count} ${unit}`;
}
