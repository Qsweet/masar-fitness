import type { PromotionStatus } from "../commerce/pricing/promotion";

/** الحالة كما تُعرض في اللوحة (ADMIN_A2_SALES §5): تُحسب من الحالة المخزَّنة والنافذة والاستخدام النشط. */
export const PROMOTION_DISPLAY_STATES = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "ended",
  "exhausted",
  "archived",
] as const;
export type PromotionDisplayState = (typeof PROMOTION_DISPLAY_STATES)[number];

export interface PromotionStateFacts {
  readonly status: PromotionStatus;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly maxRedemptions: number | null;
  /** الاستخدام النشط (طلبه ليس منتهيًا ولا ملغى)، بتعريف T4 و`loadUsage`. */
  readonly activeRedemptions: number;
}

/**
 * الفعّال يُعرض بما يحدث له فعلًا عند أول طلب تالٍ: منتهٍ (بلغ نهايته) قبل مستنفد (بلغ حده) قبل مجدول
 * (لم يبدأ)، بالترتيب نفسه الذي يرفض به `checkPromotion`.
 */
export function promotionDisplayState(
  facts: PromotionStateFacts,
  now: Date,
): PromotionDisplayState {
  if (facts.status !== "active") {
    return facts.status;
  }
  if (facts.endsAt !== null && facts.endsAt.getTime() <= now.getTime()) {
    return "ended";
  }
  if (facts.maxRedemptions !== null && facts.activeRedemptions >= facts.maxRedemptions) {
    return "exhausted";
  }
  return now.getTime() < facts.startsAt.getTime() ? "scheduled" : "running";
}
