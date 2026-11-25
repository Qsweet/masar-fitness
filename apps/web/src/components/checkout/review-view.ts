import type { OrderView } from "@masar/db";
import type { OrderStatus } from "@masar/domain";
import { whatsappUrl } from "@/config/club";
import { getDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import {
  startRuleText,
  toDiscountView,
  toLineView,
  toTotalsView,
  type DiscountView,
  type LineView,
  type TotalsView,
} from "./checkout-view";

/** ما تعرضه الصفحة لكل حالة فعلية. الاسترداد والإلغاء لا كتابة لهما في هذه المرحلة: «مغلق». */
export type ReviewState = "pending" | "paid" | "expired" | "closed";

const REVIEW_STATES: Readonly<Record<OrderStatus, ReviewState>> = {
  pending_payment: "pending",
  paid: "paid",
  fulfilled: "paid",
  expired: "expired",
  cancelled: "closed",
  partially_refunded: "closed",
  refunded: "closed",
};

/** التاريخ بالتقويم الميلادي والأرقام اللاتينية في اللغتين (القرار 15). */
const DATE_LOCALES: Readonly<Record<Locale, string>> = {
  ar: "ar-u-ca-gregory-nu-latn",
  en: "en-GB",
};

export type ReviewLineView = LineView & {
  readonly benefits: readonly string[];
  readonly startRule: string | undefined;
};

export interface ReviewView {
  readonly state: ReviewState;
  readonly title: string;
  readonly lead: string;
  readonly reference: string;
  readonly customerName: string;
  readonly maskedPhone: string;
  readonly statusText: string;
  /** موعد انتهاء المهلة بتوقيت النادي، للطلب المعلّق فقط. */
  readonly deadline: string | undefined;
  readonly lines: readonly ReviewLineView[];
  readonly discounts: readonly DiscountView[];
  readonly totals: TotalsView;
  /** واتساب النادي برسالة تحمل رقم الطلب فقط (لا اسم ولا جوال). */
  readonly whatsappHref: string;
  /** صفحة شراء الباقة نفسها لطلب جديد. */
  readonly restartHref: string;
}

/** «25 نوفمبر 2026، 3:30 م» بمنطقة النادي الزمنية لا بمنطقة الخادم. */
export function formatDeadline(instant: Date, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

function headline(state: ReviewState, locale: Locale): { title: string; lead: string } {
  const review = getDictionary(locale).checkout.review;
  const texts: Record<ReviewState, { title: string; lead: string }> = {
    pending: { title: review.pendingTitle, lead: review.pendingLead },
    paid: { title: review.paidTitle, lead: review.paidLead },
    expired: { title: review.expiredTitle, lead: review.expiredLead },
    closed: { title: review.closedTitle, lead: review.closedLead },
  };
  return texts[state];
}

function toReviewLine(item: OrderView["items"][number], locale: Locale): ReviewLineView {
  return {
    ...toLineView(item, locale),
    benefits: item.benefits.map((benefit) => benefit[locale]),
    startRule: startRuleText(item.membershipStartRule, locale),
  };
}

function deadlineText(order: OrderView, state: ReviewState, locale: Locale): string | undefined {
  if (state !== "pending") {
    return undefined;
  }
  const time = formatDeadline(order.expiresAt, order.timeZone, locale);
  return fill(getDictionary(locale).checkout.review.expiresAt, { time });
}

/** صفحة مراجعة الطلب من لقطته المختومة فقط، بالحالة الفعلية (المعلّق الفائتة مهلته منتهٍ). */
export function toReviewView(order: OrderView, locale: Locale): ReviewView {
  const review = getDictionary(locale).checkout.review;
  const state = REVIEW_STATES[order.effectiveStatus];
  const primarySlug = order.items[0]?.slug;
  return {
    state,
    ...headline(state, locale),
    reference: order.reference,
    customerName: order.customerName,
    maskedPhone: order.maskedPhone,
    statusText: review.statuses[state],
    deadline: deadlineText(order, state, locale),
    lines: order.items.map((item) => toReviewLine(item, locale)),
    discounts: order.discounts.map((discount) => toDiscountView(discount, locale)),
    totals: toTotalsView(order, locale),
    whatsappHref: whatsappUrl(fill(review.whatsappMessage, { reference: order.reference })),
    restartHref: localizedPath(
      locale,
      primarySlug === undefined ? "/memberships" : `/checkout/${primarySlug}`,
    ),
  };
}
