import { describe, expect, it } from "vitest";
import {
  ORDER_CANCEL_REASONS,
  decideOrderCancellation,
  isOrderCancelReason,
  type CancellableOrder,
} from "./order-cancellation";
import { ORDER_STATUSES } from "./order-state";

const NOW = new Date("2026-06-15T09:00:00Z");
const LATER = new Date(NOW.getTime() + 60_000);

function order(overrides: Partial<CancellableOrder> = {}): CancellableOrder {
  return { status: "pending_payment", expiresAt: LATER, hasLiveAttempt: false, ...overrides };
}

function decide(overrides: Partial<CancellableOrder> = {}, now = NOW): string {
  const decision = decideOrderCancellation(order(overrides), now);
  return decision.ok ? decision.value : decision.error.reason;
}

describe("decideOrderCancellation", () => {
  it("معلّق لم يبلغ مهلته وبلا محاولة حيّة يُلغى", () => {
    expect(decide()).toBe("apply");
  });

  it("الملغى إعادة بلا كتابة، ولو بلغ مهلته أو كانت له محاولة", () => {
    expect(decide({ status: "cancelled" })).toBe("replay");
    expect(decide({ status: "cancelled", expiresAt: NOW, hasLiveAttempt: true })).toBe("replay");
  });

  it.each(ORDER_STATUSES.filter((status) => !["pending_payment", "cancelled"].includes(status)))(
    "الحالة %s لا تُلغى",
    (status) => {
      expect(decide({ status })).toBe("order.not_cancellable");
    },
  );

  it("من بلغ مهلته منتهٍ فعلًا وإن بقي معلّقًا في القاعدة", () => {
    expect(decide({ expiresAt: NOW })).toBe("order.not_cancellable");
    expect(decide({ expiresAt: new Date(NOW.getTime() - 1) })).toBe("order.not_cancellable");
    expect(decide({ expiresAt: new Date(NOW.getTime() + 1) })).toBe("apply");
  });

  it("محاولة دفع حيّة تمنع الإلغاء", () => {
    expect(decide({ hasLiveAttempt: true })).toBe("order.cancel_blocked_by_live_attempt");
  });

  it("بلوغ المهلة يسبق المحاولة الحيّة في سبب الرفض", () => {
    expect(decide({ expiresAt: NOW, hasLiveAttempt: true })).toBe("order.not_cancellable");
  });

  it("الرفض خطأ تعارض", () => {
    const decision = decideOrderCancellation(order({ status: "paid" }), NOW);
    expect(decision.ok ? null : decision.error.code).toBe("conflict");
  });
});

describe("أسباب الإلغاء", () => {
  it("قائمة مغلقة", () => {
    expect(ORDER_CANCEL_REASONS).toEqual([
      "customer_request",
      "duplicate_order",
      "created_by_mistake",
      "other",
    ]);
    expect(isOrderCancelReason("duplicate_order")).toBe(true);
    for (const value of ["", "refund", "OTHER", null, undefined, 3]) {
      expect(isOrderCancelReason(value)).toBe(false);
    }
  });
});
