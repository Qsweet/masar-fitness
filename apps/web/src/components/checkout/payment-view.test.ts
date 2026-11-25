import type { OrderView } from "@masar/db";
import { money } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { toPaymentPanelView, withPaymentHeadline, type PaymentPanelInput } from "./payment-view";
import { toReviewView } from "./review-view";

const TOKEN = "t".repeat(43);
const ORDER: OrderView = {
  id: "order-1",
  reference: "MSR-0000042",
  customerName: "محمد",
  maskedPhone: "+966•••••••67",
  locale: "ar",
  status: "pending_payment",
  effectiveStatus: "pending_payment",
  vatRateBps: 1500,
  subtotal: money(35_000),
  discount: money(0),
  total: money(35_000),
  vat: money(4_565),
  createdAt: new Date("2026-11-25T20:30:00Z"),
  expiresAt: new Date("2026-11-25T21:00:00Z"),
  timeZone: "Asia/Riyadh",
  items: [],
  discounts: [],
};

function input(overrides: Partial<PaymentPanelInput>): PaymentPanelInput {
  return { state: "pay", retrying: false, demo: false, notice: null, ...overrides };
}

describe("toPaymentPanelView", () => {
  it("pay: زر «ادفع الآن» بلا رابط تحديث ولا واتساب", () => {
    const view = toPaymentPanelView(ORDER, input({}), "ar", TOKEN);
    expect(view).toMatchObject({
      state: "pay",
      title: "الدفع",
      payLabel: "ادفع الآن",
      refresh: null,
      whatsapp: null,
      notice: null,
      demoNotice: null,
      token: TOKEN,
      locale: "ar",
    });
  });

  it("resume: «أكمل الدفع» ورابط التحقق إلى صفحة العودة بلغة الصفحة", () => {
    const view = toPaymentPanelView(ORDER, input({ state: "resume" }), "en", TOKEN);
    expect(view).toMatchObject({
      payLabel: "Continue payment",
      refresh: { href: `/en/checkout/orders/${TOKEN}/return`, label: "Refresh payment status" },
    });
  });

  it("verifying: لا زر دفع، ورابط تحديث الحالة فقط", () => {
    const view = toPaymentPanelView(ORDER, input({ state: "verifying" }), "ar", TOKEN);
    expect(view).toMatchObject({
      payLabel: null,
      refresh: { href: `/checkout/orders/${TOKEN}/return` },
      whatsapp: null,
    });
  });

  it("review: لا زر دفع ولا تحديث، وواتساب برقم الطلب فقط", () => {
    const view = toPaymentPanelView(ORDER, input({ state: "review" }), "ar", TOKEN);
    expect(view).toMatchObject({ payLabel: null, refresh: null });
    const href = decodeURIComponent(view?.whatsapp?.href ?? "");
    expect(href).toContain("MSR-0000042");
    expect(href).not.toContain("محمد");
    expect(href).not.toContain("966•");
  });

  it.each(["paid", "expired", "closed", "unavailable"] as const)(
    "%s: لا قسم دفع (تبقى الخطوة التالية كما كانت)",
    (state) => {
      expect(toPaymentPanelView(ORDER, input({ state }), "ar", TOKEN)).toBeNull();
    },
  );

  it("التنبيهات: فشل الفتح أو كثرة المحاولات، ثم تنبيه المحاولة السابقة، وفي حالة pay فقط", () => {
    const failed = toPaymentPanelView(
      ORDER,
      input({ notice: "failed", retrying: true }),
      "ar",
      TOKEN,
    );
    expect(failed?.notice).toBe(ar.onlinePayment.panel.notices.failed);
    const throttled = toPaymentPanelView(ORDER, input({ notice: "throttled" }), "en", TOKEN);
    expect(throttled?.notice).toBe(en.onlinePayment.panel.notices.throttled);
    const retry = toPaymentPanelView(ORDER, input({ retrying: true }), "ar", TOKEN);
    expect(retry?.notice).toBe(ar.onlinePayment.panel.retryNotice);
    const verifying = input({ state: "verifying", notice: "failed", retrying: true });
    expect(toPaymentPanelView(ORDER, verifying, "ar", TOKEN)?.notice).toBeNull();
  });

  it("لافتة الوضع التجريبي تظهر مع مزوّد الاختبار فقط", () => {
    const demo = toPaymentPanelView(ORDER, input({ demo: true }), "ar", TOKEN);
    expect(demo?.demoNotice).toBe(ar.onlinePayment.panel.demoNotice);
  });
});

describe("withPaymentHeadline", () => {
  const review = toReviewView(ORDER, "ar");
  // طلب معلّق فاتت مهلته: المراجعة وحدها تعرضه منتهيًا
  const overdue = toReviewView({ ...ORDER, effectiveStatus: "expired" }, "ar");

  it("pay و resume: العنوان كما هو، والسطر يدعو إلى الدفع قبل المهلة", () => {
    for (const state of ["pay", "resume"] as const) {
      const view = withPaymentHeadline(review, state, "ar");
      expect(view).toMatchObject({ title: "طلبك محجوز", statusText: "بانتظار الدفع" });
      expect(view.lead).toBe(ar.onlinePayment.headline.payLead);
      expect(view.deadline).toBe(review.deadline);
    }
  });

  it("verifying: «نتحقق من دفعتك» لا «انتهت المهلة»، وبلا موعد", () => {
    expect(overdue.title).toBe("انتهت مهلة هذا الطلب");
    const view = withPaymentHeadline(overdue, "verifying", "ar");
    expect(view).toMatchObject({
      title: "نتحقق من دفعتك",
      statusText: "نتحقق من الدفع",
      deadline: undefined,
    });
  });

  it("review: «قيد المراجعة» بلا موعد", () => {
    const view = withPaymentHeadline(review, "review", "en");
    expect(view).toMatchObject({
      title: "Your payment is under review",
      statusText: "Under review",
      deadline: undefined,
    });
  });

  it.each(["paid", "expired", "closed", "unavailable"] as const)(
    "%s: نصوص المراجعة كما هي",
    (state) => {
      expect(withPaymentHeadline(review, state, "ar")).toBe(review);
    },
  );
});

describe("نصوص الدفع", () => {
  it("لا وعد باسترداد أو إلغاء في أي نص", () => {
    const texts = JSON.stringify([ar.onlinePayment, en.onlinePayment]);
    expect(texts).not.toMatch(/استرداد|استرجاع|إلغاء|refund|cancel/i);
  });
});
