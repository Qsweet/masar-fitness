import type { PlanView } from "@/components/plans/plan-view";
import { GOOGLE_RATING } from "@/config/club-facts";
import { formatDate } from "@/i18n/dates";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

const TENTHS = 10;

/** شارة العرض فوق صورة الواجهة: مكافأة الاشتراك الأوفر شهريًا كما في الكتالوج (محسوبة، لا مكتوبة). */
export interface OfferView {
  readonly title: string;
  readonly line: string;
}

export function offerView(
  plans: readonly PlanView[],
  dictionary: Dictionary,
): OfferView | undefined {
  const best = plans.find((plan) => plan.isBestValue && plan.bonusText !== undefined);
  if (best?.bonusText === undefined) {
    return undefined;
  }
  return { title: best.bonusText, line: fill(dictionary.hero.offerWith, { term: best.term }) };
}

/** تقييم Google بأرقامه ومصدره وتاريخ قراءته. */
export interface RatingView {
  readonly value: string;
  readonly outOf: number;
  readonly count: string;
  readonly source: string;
}

export function ratingView(dictionary: Dictionary, locale: Locale): RatingView {
  const { reviews } = dictionary;
  return {
    value: (GOOGLE_RATING.tenths / TENTHS).toFixed(1),
    outOf: GOOGLE_RATING.outOf,
    count: fill(reviews.ratingCount, { count: formatNumber(GOOGLE_RATING.count) }),
    source: fill(reviews.ratingSource, { date: formatDate(GOOGLE_RATING.readOn, locale) }),
  };
}
