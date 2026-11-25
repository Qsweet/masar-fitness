import { describe, expect, it } from "vitest";
import { parseBuyer, type Buyer } from "./buyer";
import {
  canonicalAssessmentRequest,
  canonicalOrderRequest,
  replayDecision,
  type OrderRequest,
} from "./order-request";

function buyer(mobile = "0512345678"): Buyer {
  const result = parseBuyer({ name: "نورة", mobile });
  if (!result.ok) {
    throw new Error("مشترٍ غير صالح في الاختبار");
  }
  return result.value;
}

const REQUEST: OrderRequest = {
  planSlug: "annual",
  addonSlugs: ["pt", "locker"],
  couponCode: "WELCOME10",
  buyer: buyer(),
  locale: "ar",
};

describe("canonicalOrderRequest", () => {
  it("JSON بمفاتيح مرتبة والإضافات مرتبة", () => {
    expect(canonicalOrderRequest(REQUEST)).toBe(
      '{"addonSlugs":["locker","pt"],"buyer":{"mobile":"+966512345678","name":"نورة"},' +
        '"couponCode":"WELCOME10","locale":"ar","planSlug":"annual"}',
    );
  });

  it("لا يتأثر بترتيب الإضافات ولا بتكرارها", () => {
    const reordered = { ...REQUEST, addonSlugs: ["locker", "pt", "locker"] };
    expect(canonicalOrderRequest(reordered)).toBe(canonicalOrderRequest(REQUEST));
  });

  it("الجوال المكتوب بصيغة أخرى يعطي البصمة نفسها", () => {
    const other = { ...REQUEST, buyer: buyer("+966 51 234 5678") };
    expect(canonicalOrderRequest(other)).toBe(canonicalOrderRequest(REQUEST));
  });

  it.each([
    ["الجوال", { buyer: buyer("0598765432") }],
    ["الكوبون", { couponCode: "OTHER" }],
    ["إزالة الكوبون", { couponCode: null }],
    ["الباقة", { planSlug: "monthly" }],
    ["اللغة", { locale: "en" as const }],
    ["الإضافات", { addonSlugs: ["pt"] }],
  ])("يتغير بـ%s", (_label, change) => {
    expect(canonicalOrderRequest({ ...REQUEST, ...change })).not.toBe(
      canonicalOrderRequest(REQUEST),
    );
  });
});

describe("canonicalAssessmentRequest", () => {
  it("JSON بمفاتيح مرتبة ويتغير بالمنتج", () => {
    const input = { productSlug: "assessment", buyer: buyer(), locale: "en" as const };
    expect(canonicalAssessmentRequest(input)).toBe(
      '{"buyer":{"mobile":"+966512345678","name":"نورة"},"locale":"en","productSlug":"assessment"}',
    );
    expect(canonicalAssessmentRequest({ ...input, productSlug: "other" })).not.toBe(
      canonicalAssessmentRequest(input),
    );
  });
});

describe("replayDecision", () => {
  it("البصمة نفسها ⇒ replay، وغيرها ⇒ conflict", () => {
    expect(replayDecision("abc", "abc")).toBe("replay");
    expect(replayDecision("abc", "abd")).toBe("conflict");
  });
});
