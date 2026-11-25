import { describe, expect, it } from "vitest";
import { DomainError } from "../../errors";
import {
  ORDER_EVENTS,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  TERMINAL_ORDER_STATUSES,
  effectiveOrderStatus,
  nextOrderStatus,
  orderExpiry,
  type OrderEvent,
  type OrderStatus,
} from "./order-state";

/** المتوقَّع لكل زوج (حالة، حدث)؛ ما لم يُذكر هنا يجب أن يكون انتقالًا غير صالح. */
const ALLOWED: Record<string, OrderStatus> = {
  "pending_payment/payment_verified": "paid",
  "pending_payment/expire": "expired",
  "pending_payment/cancel": "cancelled",
  "paid/fulfil": "fulfilled",
};
const REFUND_BLOCKED = ["paid", "fulfilled", "partially_refunded"].flatMap((from) => [
  `${from}/refund_partial`,
  `${from}/refund_full`,
]);

const PAIRS = ORDER_STATUSES.flatMap((status) =>
  ORDER_EVENTS.map((event): [OrderStatus, OrderEvent] => [status, event]),
);

describe("nextOrderStatus", () => {
  it("حالات الطلب السبع بترتيب enum القاعدة", () => {
    expect(ORDER_STATUSES).toEqual([
      "pending_payment",
      "paid",
      "fulfilled",
      "expired",
      "cancelled",
      "partially_refunded",
      "refunded",
    ]);
  });

  it.each(PAIRS)("مسح شامل: %s عند %s", (status, event) => {
    const key = `${status}/${event}`;
    const result = nextOrderStatus(status, event);
    if (key in ALLOWED) {
      expect(result).toEqual({ ok: true, value: ALLOWED[key] });
    } else if (REFUND_BLOCKED.includes(key)) {
      expect(result.ok ? null : result.error.reason).toBe("policy.undecided.refund_eligibility");
    } else {
      expect(result.ok ? null : result.error.reason).toBe("order.invalid_transition");
    }
  });

  it("لا مسار يعود إلى pending_payment", () => {
    expect(ORDER_TRANSITIONS.filter((t) => t.to === "pending_payment")).toEqual([]);
  });

  it("لا انتقال expired → paid", () => {
    expect(nextOrderStatus("expired", "payment_verified").ok).toBe(false);
    expect(ORDER_TRANSITIONS.some((t) => t.from === "expired")).toBe(false);
  });

  it("الحالات النهائية لا خروج منها", () => {
    expect(TERMINAL_ORDER_STATUSES).toEqual(["expired", "cancelled", "refunded"]);
    for (const status of TERMINAL_ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS.some((t) => t.from === status)).toBe(false);
    }
  });
});

describe("effectiveOrderStatus", () => {
  const expiresAt = new Date("2026-12-01T10:00:00.000Z");

  it("المعلّق قبل المهلة بملّي ثانية يبقى معلّقًا", () => {
    const now = new Date(expiresAt.getTime() - 1);
    expect(effectiveOrderStatus("pending_payment", expiresAt, now)).toBe("pending_payment");
  });

  it("المعلّق عند expires_at بالضبط منتهٍ", () => {
    expect(effectiveOrderStatus("pending_payment", expiresAt, new Date(expiresAt))).toBe("expired");
  });

  it("غير المعلّق لا يتغير ولو فاتت المهلة", () => {
    const later = new Date(expiresAt.getTime() + 1);
    expect(effectiveOrderStatus("paid", expiresAt, later)).toBe("paid");
    expect(effectiveOrderStatus("cancelled", expiresAt, later)).toBe("cancelled");
  });
});

describe("orderExpiry", () => {
  it("يضيف المهلة بالدقائق", () => {
    const createdAt = new Date("2026-12-01T10:00:00.000Z");
    expect(orderExpiry(createdAt, 30).toISOString()).toBe("2026-12-01T10:30:00.000Z");
  });

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "يرمي invariant لمهلة غير صحيحة موجبة (%s)",
    (minutes) => {
      expect(() => orderExpiry(new Date(), minutes)).toThrow(DomainError);
      expect(() => orderExpiry(new Date(), minutes)).toThrow("order.invalid_payment_window");
    },
  );

  it("يرمي invariant لتاريخ إنشاء غير صالح", () => {
    expect(() => orderExpiry(new Date(Number.NaN), 30)).toThrow("order.invalid_created_at");
  });
});
