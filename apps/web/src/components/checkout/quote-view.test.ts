import {
  basisPoints,
  buildQuote,
  DomainError,
  money,
  parseCouponCode,
  type CartLine,
  type CouponCode,
  type Quote,
} from "@masar/domain";
import { describe, expect, it } from "vitest";
import { addonChoices, couponMessage, toQuoteView } from "./quote-view";

const PLAN: CartLine = {
  productId: "plan",
  versionId: "plan-v1",
  kind: "membership",
  slug: "one-year",
  name: { ar: "السنوية", en: "Annual" },
  summary: { ar: "", en: "" },
  benefits: [],
  listPrice: money(280_000),
  paidMonths: 12,
  bonusMonths: 2,
  sortOrder: 0,
};

const ADDON: CartLine = {
  ...PLAN,
  productId: "addon",
  versionId: "addon-v1",
  kind: "addon",
  slug: "demo-addon",
  name: { ar: "إضافة تجريبية", en: "Demo add-on" },
  listPrice: money(5_000),
  paidMonths: null,
  bonusMonths: 0,
};

function code(input: string): CouponCode {
  const parsed = parseCouponCode(input);
  if (!parsed.ok || parsed.value === null) {
    throw new Error("bad test coupon");
  }
  return parsed.value;
}

function quote(): Quote {
  const result = buildQuote({
    primary: PLAN,
    addons: [ADDON],
    attachableAddonProductIds: ["addon"],
    policy: {
      vatRate: basisPoints(1500),
      currency: "SAR",
      timeZone: "Asia/Riyadh",
      orderPaymentWindowMinutes: 30,
      membershipStartRule: "on_payment",
    },
    automatic: [],
    coupon: { kind: "none" },
    now: new Date("2026-11-25T09:00:00Z"),
  });
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

describe("ملخص عرض السعر", () => {
  it("السطور بالمدة وسعر القائمة، والإجمالي وضريبته، ونص قاعدة البدء", () => {
    const view = toQuoteView(quote(), "ar");
    expect(view.lines).toEqual([
      {
        key: "one-year",
        name: "السنوية",
        detail: "14 شهرًا، منها شهران مجانًا",
        price: { amount: "2,800", unit: "ر.س" },
      },
      {
        key: "demo-addon",
        name: "إضافة تجريبية",
        detail: undefined,
        price: { amount: "50", unit: "ر.س" },
      },
    ]);
    expect(view.totals).toMatchObject({
      total: { amount: "2,850", unit: "ر.س" },
      discount: undefined,
      vatLabel: "منه ضريبة القيمة المضافة 15%",
    });
    expect(view.startRule).toBe("يبدأ الاشتراك من يوم الدفع.");
    expect(view.notes).toEqual([]);
  });

  it("الخصم باسمه ورمز الكوبون، والملاحظات: كوبون غلبه عرض، وأهلية تُتحقق عند التأكيد", () => {
    const base = quote();
    const withDiscount: Quote = {
      ...base,
      discount: money(28_000),
      discounts: [
        {
          promotionId: "p1",
          source: "coupon",
          code: code("DEMO10"),
          name: { ar: "كوبون تجريبي", en: "Demo coupon" },
          discountRule: { kind: "percentage", rate: basisPoints(1000) },
          sequence: 1,
          amount: money(28_000),
        },
      ],
      couponOutcome: { kind: "not_combinable" },
      rejectedAutomatic: [{ promotionId: "p2", reason: "promotion.audience_unverified" }],
    };
    const view = toQuoteView(withDiscount, "en");
    expect(view.discounts).toEqual([
      {
        key: "1",
        name: "Demo coupon",
        code: "Coupon DEMO10",
        amount: { amount: "280", unit: "SAR" },
      },
    ]);
    expect(view.totals.discount).toEqual({ amount: "280", unit: "SAR" });
    expect(view.notes).toHaveLength(2);
  });

  it("رسالة الكوبون: الرفض النهائي يمنع الطلب، والأهلية غير المحسومة لا تمنعه", () => {
    expect(couponMessage(quote(), "ar")).toBeUndefined();
    const ended = { ...quote(), couponError: new DomainError("validation", "promotion.ended") };
    expect(couponMessage(ended, "ar")).toEqual({
      text: "انتهت صلاحية هذا الكوبون.",
      blocking: true,
    });
    const unverified = {
      ...quote(),
      couponError: new DomainError("validation", "promotion.audience_unverified"),
    };
    expect(couponMessage(unverified, "ar")?.blocking).toBe(false);
  });

  it("خانات الإضافات بسعرها والمختار معلَّم", () => {
    const addons = [
      { slug: "demo-addon", name: ADDON.name, summary: ADDON.summary, listPrice: ADDON.listPrice },
    ];
    expect(addonChoices(addons, ["demo-addon"], "en")).toEqual([
      {
        slug: "demo-addon",
        name: "Demo add-on",
        price: { amount: "50", unit: "SAR" },
        checked: true,
      },
    ]);
    expect(addonChoices(addons, [], "ar")[0]?.checked).toBe(false);
  });
});
