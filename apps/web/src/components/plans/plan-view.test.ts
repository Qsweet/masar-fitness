import { money, type MembershipPlan } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { initialPlanSlug, toPlanViews } from "./plan-view";

function plan(overrides: Partial<MembershipPlan>): MembershipPlan {
  return {
    slug: "p",
    name: { ar: "باقة", en: "Plan" },
    summary: { ar: "", en: "" },
    price: money(35000),
    paidMonths: 1,
    bonusMonths: 0,
    benefits: [{ ar: "المسبح", en: "Pool" }],
    ...overrides,
  };
}

const monthly = plan({ slug: "monthly", name: { ar: "شهري", en: "Monthly" } });
const annual = plan({
  slug: "annual",
  name: { ar: "سنوي", en: "Annual" },
  price: money(280000),
  paidMonths: 12,
  bonusMonths: 2,
});

describe("toPlanViews", () => {
  it("يحسب نصوص المدة والسعر والشهر على الخادم بالعربية", () => {
    const [, view] = toPlanViews([monthly, annual], "ar");
    expect(view?.duration).toEqual({ count: "12", unit: "شهرًا" });
    expect(view?.bonusText).toBe("+ شهران مجانًا");
    expect(view?.durationText).toBe("14 شهرًا: 12 شهرًا + شهران مجانًا");
    expect(view?.price).toEqual({ amount: "2,800", unit: "ر.س" });
    expect(view?.monthlyText).toBe("حوالي 200 ر.س للشهر");
    expect(view?.href).toBe("/memberships/annual");
    expect(view?.isBestValue).toBe(true);
  });

  it("اشتراك الشهر الواحد بلا تكلفة شهرية ولا أشهر مجانية، والمدة كلمة وحدها", () => {
    const [view] = toPlanViews([monthly, annual], "ar");
    expect(view?.duration).toEqual({ count: undefined, unit: "شهر" });
    expect(view?.monthlyText).toBeUndefined();
    expect(view?.bonusText).toBeUndefined();
    expect(view?.durationText).toBe("شهر");
    expect(view?.isBestValue).toBe(false);
  });

  it("رابط الشراء واتساب برسالة تسمّي الاشتراك بلغة الزائر", () => {
    const [, view] = toPlanViews([monthly, annual], "en");
    const url = new URL(view?.purchaseHref ?? "");
    expect(url.hostname).toBe("wa.me");
    expect(url.searchParams.get("text")).toContain("“Annual”");
    expect(view?.href).toBe("/en/memberships/annual");
    expect(view?.benefits).toEqual(["Pool"]);
  });

  it("لا «أوفر شهريًا» حين يُعرض اشتراك واحد فقط", () => {
    expect(toPlanViews([annual], "ar")[0]?.isBestValue).toBe(false);
  });
});

describe("initialPlanSlug", () => {
  const views = toPlanViews([monthly, annual], "ar");

  it("الاشتراك المطلوب أولًا، ثم الأوفر، ولا شيء بلا اشتراكات", () => {
    expect(initialPlanSlug(views, "monthly")).toBe("monthly");
    expect(initialPlanSlug(views, "missing")).toBe("annual");
    expect(initialPlanSlug(views)).toBe("annual");
    expect(initialPlanSlug([])).toBeUndefined();
  });

  it("بلا أوفر يُختار الأول", () => {
    expect(initialPlanSlug(toPlanViews([monthly], "ar"))).toBe("monthly");
  });
});
