import { describe, expect, it } from "vitest";
import {
  ATTEMPT_EVENTS,
  ATTEMPT_STATUSES,
  ATTEMPT_TRANSITIONS,
  TERMINAL_ATTEMPT_STATUSES,
  isLiveAttempt,
  nextAttemptStatus,
  type AttemptEvent,
  type AttemptStatus,
} from "./attempt-state";

const EXPECTED: Record<string, AttemptStatus | "policy.undecided.refund_eligibility"> = {
  "created/open_session": "pending",
  "created/fail": "failed",
  "pending/authorize": "authorized",
  "pending/capture": "captured",
  "pending/fail": "failed",
  "pending/expire": "expired",
  "authorized/capture": "captured",
  "authorized/void": "voided",
  "captured/void": "voided",
  "captured/refund": "policy.undecided.refund_eligibility",
};

const PAIRS = ATTEMPT_STATUSES.flatMap((status) =>
  ATTEMPT_EVENTS.map((event): [AttemptStatus, AttemptEvent] => [status, event]),
);

describe("nextAttemptStatus", () => {
  it.each(PAIRS)("مسح شامل: %s عند %s", (status, event) => {
    const expected = EXPECTED[`${status}/${event}`];
    const result = nextAttemptStatus(status, event);
    if (expected === undefined) {
      expect(result.ok ? null : result.error.reason).toBe("payment_attempt.invalid_transition");
    } else if (expected.startsWith("policy.")) {
      expect(result.ok ? null : result.error.reason).toBe(expected);
    } else {
      expect(result).toEqual({ ok: true, value: expected });
    }
  });

  it("الجدول لا يحوي صفًا غير متوقع", () => {
    expect(ATTEMPT_TRANSITIONS).toHaveLength(Object.keys(EXPECTED).length);
  });

  it("الحالات النهائية لا خروج منها", () => {
    for (const status of TERMINAL_ATTEMPT_STATUSES) {
      expect(ATTEMPT_TRANSITIONS.some((row) => row.from === status)).toBe(false);
    }
  });
});

describe("isLiveAttempt", () => {
  it.each([
    ["created", false, true],
    ["pending", false, true],
    ["authorized", false, true],
    ["captured", false, true],
    ["captured", true, false],
    ["failed", false, false],
    ["voided", false, false],
    ["expired", false, false],
    ["refunded", true, false],
    // تسوية مسجّلة على محاولة نهائية (دفعة وصلت بعد إغلاق الجلسة) لا تعيدها حيّة
    ["expired", true, false],
  ] as const)("%s (مسوّاة: %s) ⇒ %s", (status, settled, live) => {
    expect(isLiveAttempt(status, settled)).toBe(live);
  });
});
