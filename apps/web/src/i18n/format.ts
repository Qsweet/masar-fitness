import type { Money } from "@masar/domain";
import type { Locale } from "./locales";

const MINOR_PER_MAJOR = 100;
const HALALA_DIGITS = 2;
const ARABIC_FEW_MAX = 10;
const DUAL = 2;

/** الأرقام لاتينية في اللغتين (العرف السائد في المتاجر السعودية) — القرار 15. */
const NUMBER_LOCALE = "en-US";

const CURRENCY_UNIT: Record<Locale, Record<Money["currency"], string>> = {
  ar: { SAR: "ر.س" },
  en: { SAR: "SAR" },
};

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
  return { amount, unit: CURRENCY_UNIT[locale][value.currency] };
}

/** مبلغ مقرَّب لأقرب ريال: للمقارنات التقريبية فقط («حوالي …»)، لا لمبلغ يُحصَّل. */
export function roundedMoneyParts(value: Money, locale: Locale): MoneyParts {
  const amount = new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 0 }).format(
    Math.round(value.amountMinor / MINOR_PER_MAJOR),
  );
  return { amount, unit: CURRENCY_UNIT[locale][value.currency] };
}

export interface MonthsParts {
  /** العدد إن كان يُكتب رقمًا؛ فارغ حين تغني الكلمة عنه («شهر»، «شهران»). */
  readonly count: string | undefined;
  readonly unit: string;
}

function arabicMonths(months: number): MonthsParts {
  if (months === 1) {
    return { count: undefined, unit: "شهر" };
  }
  if (months === DUAL) {
    return { count: undefined, unit: "شهران" };
  }
  // 3–10 جمع (أشهر)، 11 فأكثر مفرد منصوب (شهرًا)
  return { count: String(months), unit: months <= ARABIC_FEW_MAX ? "أشهر" : "شهرًا" };
}

/** عدد الأشهر بصيغته الصحيحة: العربية تفرّق بين المفرد والمثنى والجمع وتمييز ما فوق العشرة. */
export function monthsParts(months: number, locale: Locale): MonthsParts {
  if (locale === "ar") {
    return arabicMonths(months);
  }
  return { count: String(months), unit: months === 1 ? "month" : "months" };
}

export function formatMonths(months: number, locale: Locale): string {
  const { count, unit } = monthsParts(months, locale);
  return count === undefined ? unit : `${count} ${unit}`;
}
