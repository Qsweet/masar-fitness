import type { PromotionStatus } from "../commerce/pricing/promotion";
import { DomainError } from "../errors";
import { err, ok, type Result } from "../result";

export const PROMOTION_STATUS_ACTIONS = ["activate", "pause", "end"] as const;
export type PromotionStatusAction = (typeof PROMOTION_STATUS_ACTIONS)[number];

export function isPromotionStatusAction(value: unknown): value is PromotionStatusAction {
  return PROMOTION_STATUS_ACTIONS.some((action) => action === value);
}

export interface PromotionStatusDecision {
  readonly to: PromotionStatus;
  /** الحالة مطابقة من قبل (إرسال مزدوج): لا كتابة ولا سطر تدقيق ثانٍ. */
  readonly replay: boolean;
}

const TARGET: Readonly<Record<PromotionStatusAction, PromotionStatus>> = {
  activate: "active",
  pause: "paused",
  end: "archived",
};

const ALLOWED_FROM: Readonly<Record<PromotionStatusAction, readonly PromotionStatus[]>> = {
  activate: ["draft", "paused"],
  pause: ["active"],
  end: ["draft", "active", "paused"],
};

/** تفعيل، إيقاف مؤقت، إنهاء. المؤرشف نهائي: لا يُفعَّل ولا يُوقف. */
export function decidePromotionStatus(
  current: PromotionStatus,
  action: PromotionStatusAction,
): Result<PromotionStatusDecision, DomainError> {
  const to = TARGET[action];
  if (current === to) {
    return ok({ to, replay: true });
  }
  if (!ALLOWED_FROM[action].includes(current)) {
    const reason =
      current === "archived" ? "promotion.archived_final" : "promotion.status_not_allowed";
    return err(new DomainError("conflict", reason));
  }
  return ok({ to, replay: false });
}

/**
 * نهاية العرض عند إنهائه: «الآن» إن كان قد بدأ ولم ينتهِ (فتُقفل نافذته حيث توقف)، وإلا تبقى كما هي
 * (عرض لم يبدأ لا تُكتب له نهاية قبل بدايته: قيد `promotions_window_ordered`).
 */
export function endsAtWhenEnded(
  window: { readonly startsAt: Date; readonly endsAt: Date | null },
  now: Date,
): Date | null {
  const started = window.startsAt.getTime() < now.getTime();
  const stillOpen = window.endsAt === null || window.endsAt.getTime() > now.getTime();
  return started && stillOpen ? now : window.endsAt;
}
