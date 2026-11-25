import { describe, expect, it } from "vitest";
import { paymentDisplayState, type PaymentDisplayInput } from "./display";

const NOW = new Date("2026-06-15T09:10:00Z");
const EXPIRES = new Date("2026-06-15T09:30:00Z");
const DEADLINE = new Date("2026-06-15T09:25:00Z");
const AFTER_EXPIRY = new Date("2026-06-15T09:31:00Z");

function input(overrides: Partial<PaymentDisplayInput> = {}): PaymentDisplayInput {
  return {
    orderStatus: "pending_payment",
    orderExpiresAt: EXPIRES,
    now: NOW,
    liveAttempt: null,
    hasOpenIncident: false,
    canStart: true,
    ...overrides,
  };
}

const pending = { status: "pending", deadlineAt: DEADLINE } as const;

describe("paymentDisplayState", () => {
  it.each([
    ["معلّق ويمكن البدء", input(), "pay"],
    ["معلّق والدفع غير مضبوط أو لا وقت", input({ canStart: false }), "unavailable"],
    ["محاولة pending قبل موعدها", input({ liveAttempt: pending }), "resume"],
    ["محاولة pending بعد موعدها", input({ liveAttempt: pending, now: DEADLINE }), "verifying"],
    [
      "محاولة حيّة وفاتت مهلة الطلب: نتحقق، لا «انتهت المهلة»",
      input({ liveAttempt: pending, now: AFTER_EXPIRY }),
      "verifying",
    ],
    [
      "محاولة created أو captured غير مسوّاة",
      input({ liveAttempt: { status: "captured", deadlineAt: DEADLINE } }),
      "verifying",
    ],
    ["معلّق فاتت مهلته بلا محاولة حيّة", input({ now: AFTER_EXPIRY }), "expired"],
    ["حادثة مفتوحة تحجب زر الدفع", input({ hasOpenIncident: true }), "review"],
    ["حادثة على طلب منتهٍ", input({ orderStatus: "expired", hasOpenIncident: true }), "review"],
    ["مدفوع", input({ orderStatus: "paid" }), "paid"],
    ["مسلَّم ولو عليه حادثة", input({ orderStatus: "fulfilled", hasOpenIncident: true }), "paid"],
    ["منتهٍ", input({ orderStatus: "expired" }), "expired"],
    ["ملغى", input({ orderStatus: "cancelled" }), "closed"],
    ["مسترد", input({ orderStatus: "refunded" }), "closed"],
  ] as const)("%s ⇒ %s", (_name, value, expected) => {
    expect(paymentDisplayState(value)).toBe(expected);
  });
});
