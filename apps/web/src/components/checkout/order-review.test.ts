import type { OrderView } from "@masar/db";
import { money } from "@masar/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { OrderReview } from "./order-review";
import { toReviewView } from "./review-view";

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

const labels = getDictionary("ar").checkout;

function render(preview: boolean): string {
  const view = toReviewView(ORDER, "ar");
  return renderToStaticMarkup(createElement(OrderReview, { view, labels, preview }));
}

describe("OrderReview", () => {
  it("بلا معاينة: الخطوة التالية واتساب برقم الطلب", () => {
    const html = render(false);
    expect(html).toContain(labels.review.whatsapp);
    expect(html).not.toContain(labels.review.previewNotice);
  });

  it("معاينة الشراء: الطلب تجريبي بلا رابط واتساب ولا خطوة دفع", () => {
    const html = render(true);
    expect(html).toContain(labels.review.previewNotice);
    expect(html).not.toContain(labels.review.whatsapp);
    expect(html).not.toContain("wa.me");
  });
});
