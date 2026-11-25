import { describe, expect, it } from "vitest";
import { DomainError } from "../../errors";
import { blockerError, checkoutBlockers, decidedCheckout } from "./commerce-policy";
import { DECIDED_POLICY } from "./test-support";

const NO_WINDOW = { ...DECIDED_POLICY, orderPaymentWindowMinutes: null };
const NO_RULE = { ...DECIDED_POLICY, membershipStartRule: null };
const NOTHING_DECIDED = { ...NO_WINDOW, membershipStartRule: null };

describe("checkoutBlockers", () => {
  it("لا مانع والسياستان محسومتان", () => {
    expect(checkoutBlockers(DECIDED_POLICY, "membership")).toEqual([]);
    expect(checkoutBlockers(DECIDED_POLICY, "digital_program")).toEqual([]);
  });

  it("المهلة غير المحسومة تمنع كل طلب", () => {
    expect(checkoutBlockers(NO_WINDOW, "membership")).toEqual(["order_payment_window"]);
    expect(checkoutBlockers(NO_WINDOW, "digital_program")).toEqual(["order_payment_window"]);
  });

  it("قاعدة البدء تُطلب لطلبات الاشتراك فقط", () => {
    expect(checkoutBlockers(NO_RULE, "membership")).toEqual(["membership_start_rule"]);
    expect(checkoutBlockers(NO_RULE, "digital_program")).toEqual([]);
  });

  it("السياستان غير محسومتين بترتيب ثابت: المهلة أولًا", () => {
    expect(checkoutBlockers(NOTHING_DECIDED, "membership")).toEqual([
      "order_payment_window",
      "membership_start_rule",
    ]);
  });
});

describe("blockerError", () => {
  it("يرجع تعارض أول سياسة غير محسومة", () => {
    const error = blockerError(["membership_start_rule", "order_payment_window"]);
    expect(error.code).toBe("conflict");
    expect(error.reason).toBe("policy.undecided.membership_start_rule");
  });

  it("القائمة الفارغة عطل استدعاء لا خطأ عميل", () => {
    expect(() => blockerError([])).toThrow(DomainError);
    expect(() => blockerError([])).toThrow("invariant: policy.no_blockers");
  });
});

describe("decidedCheckout", () => {
  it("يرجع المهلة وقاعدة البدء للاشتراك", () => {
    const result = decidedCheckout(DECIDED_POLICY, "membership");
    expect(result).toEqual({
      ok: true,
      value: { paymentWindowMinutes: 30, membershipStartRule: "on_payment" },
    });
  });

  it("البرنامج الرقمي لا تُختم له قاعدة بدء ولو كانت محسومة", () => {
    const result = decidedCheckout(NO_RULE, "digital_program");
    expect(result).toEqual({
      ok: true,
      value: { paymentWindowMinutes: 30, membershipStartRule: null },
    });
  });

  it("السياسة غير المحسومة ترجع خطأ أولها", () => {
    const result = decidedCheckout(NOTHING_DECIDED, "membership");
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.reason).toBe("policy.undecided.order_payment_window");
  });
});
