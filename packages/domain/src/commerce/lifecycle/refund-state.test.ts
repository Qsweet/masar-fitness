import { describe, expect, it } from "vitest";
import {
  REFUND_EVENTS,
  REFUND_STATUSES,
  REFUND_TRANSITIONS,
  TERMINAL_REFUND_STATUSES,
  nextRefundStatus,
  requestedRefundStatus,
  type RefundEvent,
  type RefundStatus,
} from "./refund-state";

const EXPECTED: Record<string, RefundStatus | "policy.undecided.refund_eligibility"> = {
  "requested/approve": "policy.undecided.refund_eligibility",
  "requested/reject": "rejected",
  "approved/start": "processing",
  "processing/complete": "completed",
  "processing/fail": "failed",
};

const PAIRS = REFUND_STATUSES.flatMap((status) =>
  REFUND_EVENTS.map((event): [RefundStatus, RefundEvent] => [status, event]),
);

describe("nextRefundStatus", () => {
  it.each(PAIRS)("مسح شامل: %s عند %s", (status, event) => {
    const expected = EXPECTED[`${status}/${event}`];
    const result = nextRefundStatus(status, event);
    if (expected === undefined) {
      expect(result.ok ? null : result.error.reason).toBe("refund.invalid_transition");
    } else if (expected.startsWith("policy.")) {
      expect(result.ok ? null : result.error.reason).toBe(expected);
    } else {
      expect(result).toEqual({ ok: true, value: expected });
    }
  });

  it("طلب الاسترداد نفسه محجوب حتى تُحسم الأهلية", () => {
    const result = requestedRefundStatus();
    expect(result.ok ? null : [result.error.code, result.error.reason]).toEqual([
      "conflict",
      "policy.undecided.refund_eligibility",
    ]);
  });

  it("الحالات النهائية لا خروج منها", () => {
    for (const status of TERMINAL_REFUND_STATUSES) {
      expect(REFUND_TRANSITIONS.some((t) => t.from === status)).toBe(false);
    }
  });
});
