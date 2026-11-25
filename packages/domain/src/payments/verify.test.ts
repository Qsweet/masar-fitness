import { describe, expect, it } from "vitest";
import type { AttemptStatus } from "./attempt-state";
import type {
  AttemptFacts,
  ProviderPaymentSnapshot,
  ProviderPaymentState,
  ProviderSessionSnapshot,
} from "./snapshot";
import { decideVerification, type VerificationContext } from "./verify";

const ATTEMPT_ID = "0193a000-0000-7000-8000-000000000001";
const SESSION_ID = "session-1";
const AMOUNT = 90_000;
const DEADLINE = new Date("2026-06-15T09:25:00Z");
const HOUR_MS = 3_600_000;
const BEFORE: VerificationContext = {
  now: new Date("2026-06-15T09:10:00Z"),
  stuckAlertAfterMs: HOUR_MS,
};
const LATE: VerificationContext = {
  now: new Date("2026-06-15T10:25:00Z"),
  stuckAlertAfterMs: HOUR_MS,
};

function attempt(overrides: Partial<AttemptFacts> = {}): AttemptFacts {
  return {
    id: ATTEMPT_ID,
    status: "pending",
    settled: false,
    provider: "fake",
    providerMode: "test",
    providerSessionId: SESSION_ID,
    providerPaymentId: null,
    deadlineAt: DEADLINE,
    ...overrides,
  };
}

function payment(
  state: ProviderPaymentState,
  overrides: Partial<ProviderPaymentSnapshot> = {},
): ProviderPaymentSnapshot {
  return {
    paymentId: `pay-${state}`,
    state,
    rawStatus: state,
    amountMinor: AMOUNT,
    currency: "SAR",
    sessionId: SESSION_ID,
    method: "creditcard",
    couponApplied: false,
    ...overrides,
  };
}

function session(
  payments: readonly ProviderPaymentSnapshot[] = [],
  overrides: Partial<ProviderSessionSnapshot> = {},
): ProviderSessionSnapshot {
  return {
    provider: "fake",
    sessionId: SESSION_ID,
    mode: "test",
    state: "open",
    rawStatus: "initiated",
    attemptId: ATTEMPT_ID,
    payments,
    ...overrides,
  };
}

function kinds(decision: ReturnType<typeof decideVerification>): string[] {
  return decision.action === "ignore" ? [] : decision.incidents.map((incident) => incident.kind);
}

describe("decideVerification: المراجع أولًا", () => {
  it("محاولة بلا جلسة لا يُتحقق منها", () => {
    const decision = decideVerification(attempt({ providerSessionId: null }), session(), BEFORE);
    expect(decision).toEqual({ action: "ignore", reason: "no_session" });
  });

  it.each([
    ["provider_mismatch", session([payment("paid")], { provider: "other" })],
    ["session_mismatch", session([payment("paid")], { sessionId: "session-2" })],
    ["attempt_mismatch", session([payment("paid")], { attemptId: "another-attempt" })],
    ["attempt_mismatch", session([payment("paid")], { attemptId: null })],
    ["mode_mismatch", session([payment("paid")], { mode: "live" })],
    ["payment_session_mismatch", session([payment("paid", { sessionId: "session-2" })])],
    ["payment_session_mismatch", session([payment("paid", { sessionId: null })])],
  ])("%s ⇒ حادثة unknown_reference بلا تسوية", (reason, snapshot) => {
    const decision = decideVerification(attempt(), snapshot, BEFORE);
    expect(decision.action).toBe("incident");
    expect(decision).toMatchObject({
      incidents: [{ kind: "unknown_reference", data: { reason } }],
    });
  });
});

describe("decideVerification: الدفعة المدفوعة", () => {
  it("تُسوّى بقيمها الخام وتتقدم المحاولة إلى captured", () => {
    const decision = decideVerification(attempt(), session([payment("paid")]), BEFORE);
    expect(decision).toEqual({
      action: "settle",
      event: "capture",
      payment: {
        provider: "fake",
        providerPaymentId: "pay-paid",
        amountMinor: AMOUNT,
        currency: "SAR",
      },
      method: "creditcard",
      incidents: [],
    });
  });

  it("المبلغ والعملة المخالفان يمرّان خامَين: المقارنة في markOrderPaid وحدها", () => {
    const short = payment("paid", { amountMinor: AMOUNT - 1, currency: "USD" });
    const decision = decideVerification(attempt(), session([short]), BEFORE);
    expect(decision).toMatchObject({
      action: "settle",
      payment: { amountMinor: AMOUNT - 1, currency: "USD" },
    });
  });

  it.each([0, -100, 900.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "مبلغ ليس هللات صحيحة موجبة لا يصل إلى التسوية: %s",
    (amountMinor) => {
      const decision = decideVerification(
        attempt(),
        session([payment("paid", { amountMinor })]),
        BEFORE,
      );
      expect(decision.action).toBe("incident");
      expect(kinds(decision)).toEqual(["amount_mismatch"]);
    },
  );

  it("كوبون طبّقه المزوّد: حادثة مع التسوية (المبلغ يحسمه markOrderPaid)", () => {
    const decision = decideVerification(
      attempt(),
      session([payment("paid", { couponApplied: true })]),
      BEFORE,
    );
    expect(decision.action).toBe("settle");
    expect(kinds(decision)).toEqual(["coupon_applied_by_provider"]);
  });

  it("دفعتان مدفوعتان على جلسة واحدة: الأولى تُسوّى والثانية حادثة", () => {
    const second = payment("paid", { paymentId: "pay-second" });
    const decision = decideVerification(attempt(), session([payment("paid"), second]), BEFORE);
    expect(decision).toMatchObject({
      action: "settle",
      payment: { providerPaymentId: "pay-paid" },
    });
    expect(decision).toMatchObject({
      incidents: [{ kind: "order_already_paid", data: { providerPaymentId: "pay-second" } }],
    });
  });

  it("الدفعة المحفوظة على المحاولة تُفضَّل على غيرها عند الإعادة", () => {
    const second = payment("paid", { paymentId: "pay-second" });
    const decision = decideVerification(
      attempt({ status: "captured", providerPaymentId: "pay-second" }),
      session([payment("paid"), second]),
      BEFORE,
    );
    expect(decision).toMatchObject({
      action: "settle",
      event: null,
      payment: { providerPaymentId: "pay-second" },
    });
  });

  it.each(["failed", "expired", "voided"] as const)(
    "دفعة مدفوعة على محاولة نهائية (%s) لا تُهمل: تُسوّى بلا انتقال حالة",
    (status) => {
      const decision = decideVerification(attempt({ status }), session([payment("paid")]), BEFORE);
      expect(decision).toMatchObject({ action: "settle", event: null });
    },
  );

  it("من authorized تتقدم إلى captured", () => {
    const decision = decideVerification(
      attempt({ status: "authorized" }),
      session([payment("paid")]),
      BEFORE,
    );
    expect(decision).toMatchObject({ action: "settle", event: "capture" });
  });
});

describe("decideVerification: بلا دفعة مدفوعة", () => {
  it.each([
    ["جلسة مفتوحة بلا دفعات", session()],
    ["جلسة مفتوحة ودفعة فاشلة (يعيد العميل المحاولة)", session([payment("failed")])],
    [
      "جلسة مغلقة ودفعة ما زالت جارية (3DS)",
      session([payment("in_progress")], { state: "closed" }),
    ],
    ["جلسة مغلقة ودفعة بحالة غير محسومة", session([payment("indeterminate")], { state: "closed" })],
    ["جلسة بحالة غير محسومة", session([], { state: "indeterminate" })],
  ])("%s ⇒ تبقى pending", (_name, snapshot) => {
    expect(decideVerification(attempt(), snapshot, BEFORE)).toEqual({
      action: "update",
      event: null,
      failureReason: null,
      incidents: [],
    });
  });

  it("دفعة مفوَّضة ⇒ authorized", () => {
    const decision = decideVerification(attempt(), session([payment("authorized")]), BEFORE);
    expect(decision).toMatchObject({ action: "update", event: "authorize" });
  });

  it("جلسة مغلقة بلا دفعات ⇒ expired", () => {
    const decision = decideVerification(attempt(), session([], { state: "closed" }), BEFORE);
    expect(decision).toEqual({
      action: "update",
      event: "expire",
      failureReason: null,
      incidents: [],
    });
  });

  it.each(["failed", "voided", "refunded"] as const)(
    "جلسة مغلقة وكل دفعاتها نهائية بلا مال (%s) ⇒ failed",
    (state) => {
      const decision = decideVerification(
        attempt(),
        session([payment(state)], { state: "closed" }),
        BEFORE,
      );
      expect(decision).toMatchObject({
        action: "update",
        event: "fail",
        failureReason: "payment_failed",
      });
    },
  );

  it("محاولة حيّة بعد الموعد والعتبة ⇒ حادثة stuck_pending وتبقى حيّة", () => {
    const decision = decideVerification(attempt(), session([payment("in_progress")]), LATE);
    expect(decision).toMatchObject({ action: "update", event: null });
    expect(kinds(decision)).toEqual(["stuck_pending"]);
  });

  it("محاولة captured لم تُسوَّ ثم عكسها المزوّد ⇒ voided وحادثة", () => {
    const decision = decideVerification(
      attempt({ status: "captured", providerPaymentId: "pay-voided" }),
      session([payment("voided")]),
      BEFORE,
    );
    expect(decision).toMatchObject({ action: "update", event: "void" });
    expect(kinds(decision)).toEqual(["provider_reversed"]);
  });

  it.each(["failed", "expired", "voided", "refunded"] as AttemptStatus[])(
    "محاولة نهائية (%s) بلا دفعة مدفوعة تُتجاهل",
    (status) => {
      const decision = decideVerification(attempt({ status }), session([payment("failed")]), LATE);
      expect(decision).toEqual({ action: "ignore", reason: "attempt_closed" });
    },
  );
});

describe("decideVerification: محاولة مسوّاة", () => {
  const settled = attempt({ status: "captured", settled: true, providerPaymentId: "pay-paid" });

  it("الدفعة نفسها ما زالت مدفوعة ⇒ لا شيء", () => {
    const decision = decideVerification(settled, session([payment("paid")]), LATE);
    expect(decision).toEqual({ action: "ignore", reason: "settled" });
  });

  it("عكس لاحق (voided) ⇒ حادثة provider_reversed والمحاولة voided", () => {
    const reversed = payment("voided", { paymentId: "pay-paid" });
    const decision = decideVerification(settled, session([reversed]), LATE);
    expect(decision).toMatchObject({ action: "update", event: "void" });
    expect(kinds(decision)).toEqual(["provider_reversed"]);
  });

  it("استرداد من لوحة المزوّد ⇒ حادثة بلا انتقال (الاسترداد محجوب بقرار المالك)", () => {
    const refunded = payment("refunded", { paymentId: "pay-paid" });
    const decision = decideVerification(settled, session([refunded]), LATE);
    expect(decision).toMatchObject({ action: "update", event: null });
    expect(kinds(decision)).toEqual(["provider_reversed"]);
  });

  it("دفعة ثانية مدفوعة على الجلسة بعد التسوية ⇒ حادثة order_already_paid", () => {
    const second = payment("paid", { paymentId: "pay-second" });
    const decision = decideVerification(settled, session([payment("paid"), second]), LATE);
    expect(kinds(decision)).toEqual(["order_already_paid"]);
  });
});
