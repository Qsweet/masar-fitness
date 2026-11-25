import { DomainError, ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";

const quoteCart = vi.fn();
const listPlanAddons = vi.fn(() => Promise.resolve([]));
vi.mock("@masar/db", () => ({ quoteCart, listPlanAddons }));
vi.mock("../db", () => ({ getDb: () => ({}) }));
const throttle = { allowed: true };
const allowCouponCheck = vi.fn(() => throttle.allowed);
vi.mock("./throttle", () => ({
  allowCouponCheck,
  requestIp: () => Promise.resolve("203.0.113.7"),
}));

const { getCheckoutQuote } = await import("./quote");

function quoteWith(couponError: DomainError | null) {
  quoteCart.mockResolvedValueOnce(ok({ couponError, blockers: [] }));
}

async function couponReason(couponInput: string): Promise<string | undefined> {
  const result = await getCheckoutQuote({ slug: "one-year", addonSlugs: [], couponInput });
  if (!result.ok) {
    throw result.error;
  }
  return result.value.quote.couponError?.reason;
}

afterEach(() => {
  throttle.allowed = true;
  quoteCart.mockReset();
  allowCouponCheck.mockClear();
});

describe("عرض السعر العام لا يكشف الرموز", () => {
  it.each([
    "coupon.unknown",
    "promotion.inactive",
    "promotion.not_started",
    "promotion.ended",
    "promotion.exhausted",
    "promotion.audience_mismatch",
    "promotion.not_applicable",
  ])("رفض %s يصبح نصًا واحدًا على حقل الكوبون", async (reason) => {
    quoteWith(new DomainError("validation", reason, { field: "coupon" }));
    expect(await couponReason("SOMECODE")).toBe("coupon.rejected");
  });

  it("الأهلية بعد الجوال تبقى معلومة بتفصيلها، والكوبون المقبول بلا خطأ", async () => {
    quoteWith(new DomainError("conflict", "promotion.audience_unverified", { field: "coupon" }));
    expect(await couponReason("NEWBIE")).toBe("promotion.audience_unverified");
    quoteWith(null);
    expect(await couponReason("DEMO10")).toBeUndefined();
  });

  it("الصيغة الخاطئة لا تُحسب فحصًا ولا تصل القاعدة بكوبون", async () => {
    quoteWith(null);
    expect(await couponReason("!!")).toBe("coupon.invalid_format");
    expect(allowCouponCheck).not.toHaveBeenCalled();
    expect(quoteCart).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ couponCode: null }),
      expect.any(Date),
    );
  });

  it("بلا كوبون لا يُعدّ فحص", async () => {
    quoteWith(null);
    expect(await couponReason("")).toBeUndefined();
    expect(allowCouponCheck).not.toHaveBeenCalled();
  });

  it("تجاوز حد الفحوص ⇒ لا يُفحص الرمز، والسعر بلا خصم، والخطأ على حقله", async () => {
    throttle.allowed = false;
    quoteWith(null);
    expect(await couponReason("DEMO10")).toBe("coupon.throttled");
    expect(allowCouponCheck).toHaveBeenCalledWith("203.0.113.7");
    expect(quoteCart).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ couponCode: null }),
      expect.any(Date),
    );
  });
});
