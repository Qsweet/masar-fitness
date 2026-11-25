import { describe, expect, it } from "vitest";
import { money } from "../../money";
import { checkPromotion, type CustomerStanding, type PromotionRule } from "./promotion";
import { candidate, promotionRule } from "./test-support";
import { basisPoints } from "./vat";

const STARTS_AT = new Date("2026-12-01T00:00:00Z");
const ENDS_AT = new Date("2026-12-31T00:00:00Z");
const INSIDE = new Date("2026-12-10T12:00:00Z");
const MILLISECOND = 1;

function rule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return promotionRule({
    id: "promo-1",
    discount: { kind: "percentage", rate: basisPoints(1000) },
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    ...overrides,
  });
}

function reasonOf(
  target: PromotionRule,
  options: {
    now?: Date;
    standing?: CustomerStanding;
    productIds?: readonly string[];
    usage?: readonly [number, number];
  } = {},
): string | null {
  const [total, byCustomer] = options.usage ?? [0, 0];
  const result = checkPromotion(
    candidate(target, total, byCustomer),
    options.productIds ?? ["plan-a"],
    { now: options.now ?? INSIDE, standing: options.standing ?? "new" },
  );
  if (result.ok) {
    return null;
  }
  expect(result.error.code).toBe("conflict");
  return result.error.reason;
}

describe("checkPromotion — الحالة والنافذة", () => {
  it("المسودة والمؤرشف غير نشطين", () => {
    expect(reasonOf(rule({ status: "draft" }))).toBe("promotion.inactive");
    expect(reasonOf(rule({ status: "archived" }))).toBe("promotion.inactive");
  });

  it("لحظة البداية بالضبط داخل النافذة، وما قبلها بجزء من الثانية لم يبدأ", () => {
    expect(reasonOf(rule(), { now: STARTS_AT })).toBeNull();
    const before = new Date(STARTS_AT.getTime() - MILLISECOND);
    expect(reasonOf(rule(), { now: before })).toBe("promotion.not_started");
  });

  it("لحظة النهاية بالضبط خارج النافذة، وما قبلها بجزء من الثانية داخلها", () => {
    expect(reasonOf(rule(), { now: ENDS_AT })).toBe("promotion.ended");
    expect(reasonOf(rule(), { now: new Date(ENDS_AT.getTime() - MILLISECOND) })).toBeNull();
  });

  it("بلا نهاية يبقى ساريًا", () => {
    expect(reasonOf(rule({ endsAt: null }), { now: new Date("2099-01-01T00:00:00Z") })).toBeNull();
  });

  it("الحالة تُفحص قبل النافذة", () => {
    expect(reasonOf(rule({ status: "draft" }), { now: ENDS_AT })).toBe("promotion.inactive");
  });
});

describe("checkPromotion — النطاق", () => {
  it("لا تقاطع مع منتجات السلة ⇒ لا ينطبق", () => {
    const listed = rule({ scope: { kind: "listed_products", productIds: ["plan-b"] } });
    expect(reasonOf(listed)).toBe("promotion.not_applicable");
    expect(reasonOf(listed, { productIds: ["plan-a", "plan-b"] })).toBeNull();
  });

  it("نطاق قائمة فارغة لا ينطبق على شيء", () => {
    const empty = rule({ scope: { kind: "listed_products", productIds: [] } });
    expect(reasonOf(empty)).toBe("promotion.not_applicable");
  });

  it("النافذة تُفحص قبل النطاق", () => {
    const listed = rule({ scope: { kind: "listed_products", productIds: ["plan-b"] } });
    expect(reasonOf(listed, { now: ENDS_AT })).toBe("promotion.ended");
  });
});

describe("checkPromotion — الجمهور", () => {
  it("unknown يرفض العرض المقيَّد بجمهور أو بحد للعميل ويقبل anyone", () => {
    expect(reasonOf(rule({ audience: "new_customer" }), { standing: "unknown" })).toBe(
      "promotion.audience_unverified",
    );
    expect(reasonOf(rule({ audience: "existing_customer" }), { standing: "unknown" })).toBe(
      "promotion.audience_unverified",
    );
    expect(reasonOf(rule({ maxRedemptionsPerCustomer: 1 }), { standing: "unknown" })).toBe(
      "promotion.audience_unverified",
    );
    expect(reasonOf(rule(), { standing: "unknown" })).toBeNull();
    expect(reasonOf(rule({ maxRedemptions: 10 }), { standing: "unknown" })).toBeNull();
  });

  it("الجمهور المخالف للمكانة الحقيقية مرفوض والمطابق مقبول", () => {
    expect(reasonOf(rule({ audience: "new_customer" }), { standing: "existing" })).toBe(
      "promotion.audience_mismatch",
    );
    expect(reasonOf(rule({ audience: "existing_customer" }), { standing: "new" })).toBe(
      "promotion.audience_mismatch",
    );
    expect(reasonOf(rule({ audience: "new_customer" }), { standing: "new" })).toBeNull();
    expect(reasonOf(rule({ audience: "existing_customer" }), { standing: "existing" })).toBeNull();
  });
});

describe("checkPromotion — الحدود", () => {
  it("الحد الكلي: بلوغه يستنفد العرض، وما دونه مقبول", () => {
    const limited = rule({ maxRedemptions: 3 });
    expect(reasonOf(limited, { usage: [3, 0] })).toBe("promotion.exhausted");
    expect(reasonOf(limited, { usage: [2, 0] })).toBeNull();
  });

  it("حد العميل: بلوغه مرفوض، وما دونه مقبول", () => {
    const limited = rule({ maxRedemptionsPerCustomer: 1 });
    expect(reasonOf(limited, { usage: [5, 1] })).toBe("promotion.customer_limit_reached");
    expect(reasonOf(limited, { usage: [5, 0] })).toBeNull();
  });

  it("الحد الكلي يُفحص قبل حد العميل، والجمهور قبلهما", () => {
    const both = rule({ maxRedemptions: 1, maxRedemptionsPerCustomer: 1 });
    expect(reasonOf(both, { usage: [1, 1] })).toBe("promotion.exhausted");
    const audience = rule({ audience: "new_customer", maxRedemptions: 1 });
    expect(reasonOf(audience, { usage: [1, 0], standing: "existing" })).toBe(
      "promotion.audience_mismatch",
    );
  });

  it("العرض الثابت يمر بالفحوص نفسها", () => {
    const fixed = rule({ discount: { kind: "fixed_amount", amount: money(5000) } });
    expect(reasonOf(fixed)).toBeNull();
  });
});
