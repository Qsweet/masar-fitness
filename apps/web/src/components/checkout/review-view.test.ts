import type { OrderView } from "@masar/db";
import { money } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { formatDeadline, toReviewView } from "./review-view";

const ORDER: OrderView = {
  id: "order-1",
  reference: "MSR-0000042",
  customerName: "محمد",
  maskedPhone: "+966•••••••67",
  locale: "ar",
  status: "pending_payment",
  effectiveStatus: "pending_payment",
  vatRateBps: 1500,
  subtotal: money(285_000),
  discount: money(28_500),
  total: money(256_500),
  vat: money(33_457),
  createdAt: new Date("2026-11-25T20:30:00Z"),
  expiresAt: new Date("2026-11-25T21:00:00Z"),
  timeZone: "Asia/Riyadh",
  items: [
    {
      position: 0,
      kind: "membership",
      slug: "one-year",
      name: { ar: "السنوية", en: "Annual" },
      summary: { ar: "", en: "" },
      benefits: [{ ar: "المسبح", en: "Swimming pool" }],
      paidMonths: 12,
      bonusMonths: 2,
      membershipStartRule: "on_payment",
      listPrice: money(280_000),
      discount: money(28_000),
      total: money(252_000),
      vat: money(32_870),
    },
  ],
  discounts: [
    {
      source: "coupon",
      code: "DEMO10",
      name: { ar: "كوبون تجريبي", en: "Demo coupon" },
      sequence: 1,
      amount: money(28_500),
    },
  ],
};

describe("مراجعة الطلب", () => {
  it("المعلّق: المرجع والجوال المقنَّع والمهلة بتوقيت النادي وواتساب برقم الطلب فقط", () => {
    const view = toReviewView(ORDER, "ar");
    expect(view).toMatchObject({
      state: "pending",
      title: "طلبك محجوز",
      reference: "MSR-0000042",
      maskedPhone: "+966•••••••67",
      statusText: "بانتظار الدفع",
      restartHref: "/checkout/one-year",
    });
    // 21:00Z = منتصف الليل في الرياض: اليوم التالي بتوقيت النادي
    expect(view.deadline).toContain("26");
    expect(view.deadline).toContain("2026");
    const message = decodeURIComponent(view.whatsappHref.split("text=")[1] ?? "");
    expect(message).toBe("مرحبًا، أرغب في إتمام دفع طلبي رقم MSR-0000042.");
    expect(view.lines[0]).toMatchObject({
      detail: "14 شهرًا: 12 شهرًا + شهران مجانًا",
      benefits: ["المسبح"],
      startRule: "يبدأ الاشتراك من يوم الدفع.",
    });
    expect(view.totals.vatLabel).toBe("منه ضريبة القيمة المضافة 15%");
  });

  it("المنتهي: عنوانه ورابط بدء جديد بلغة الزائر، ولا مهلة", () => {
    const view = toReviewView({ ...ORDER, effectiveStatus: "expired" }, "en");
    expect(view).toMatchObject({
      state: "expired",
      title: "This order has expired",
      deadline: undefined,
      restartHref: "/en/checkout/one-year",
    });
  });

  it("المدفوع والمكتمل «مدفوع»، والحالات بلا كاتب في هذه المرحلة «مغلق»", () => {
    expect(toReviewView({ ...ORDER, effectiveStatus: "fulfilled" }, "ar").state).toBe("paid");
    expect(toReviewView({ ...ORDER, effectiveStatus: "refunded" }, "ar").state).toBe("closed");
    expect(toReviewView({ ...ORDER, effectiveStatus: "cancelled" }, "ar").statusText).toBe("مغلق");
  });

  it("المهلة بأرقام لاتينية وتقويم ميلادي باللغتين", () => {
    const instant = new Date("2026-11-25T12:05:00Z");
    expect(formatDeadline(instant, "Asia/Riyadh", "en")).toBe("25 November 2026 at 15:05");
    expect(formatDeadline(instant, "Asia/Riyadh", "ar")).toMatch(/25 نوفمبر 2026/u);
  });
});
