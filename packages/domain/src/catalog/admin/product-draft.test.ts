import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_MINOR } from "../../commerce/pricing/limits";
import {
  validateProductDraft,
  validateProductIdentity,
  validateProductTerms,
  type ProductDraftInput,
} from "./product-draft";

const INPUT: ProductDraftInput = {
  kind: "membership",
  slug: "three-months",
  nameAr: "3 أشهر",
  nameEn: "3 months",
  summaryAr: "كل المرافق.",
  summaryEn: "Every facility.",
  tierAr: "انطلاقة الأبطال",
  tierEn: "Champions' Start",
  sortOrder: "2",
  price: "699",
  durationMonths: "3",
  bonusMonths: "1",
  benefits: [
    { ar: "المسبح", en: "Pool", sortOrder: "2" },
    { ar: "", en: "", sortOrder: "" },
    { ar: "صالة الحديد", en: "Strength floor", sortOrder: "1" },
  ],
};

function reasons(result: { ok: boolean; error?: readonly { field: string; reason: string }[] }) {
  return Object.fromEntries((result.error ?? []).map((issue) => [issue.field, issue.reason]));
}

describe("validateProductDraft", () => {
  it("مدخل صحيح: السعر بالهللة، والمزايا بترتيب أرقامها، والصف الفارغ يُهمل", () => {
    const result = validateProductDraft(INPUT);
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "membership",
        slug: "three-months",
        identity: {
          name: { ar: "3 أشهر", en: "3 months" },
          summary: { ar: "كل المرافق.", en: "Every facility." },
          tier: { ar: "انطلاقة الأبطال", en: "Champions' Start" },
          sortOrder: 2,
        },
        terms: {
          priceMinor: 69_900,
          durationMonths: 3,
          bonusMonths: 1,
          benefits: [
            { ar: "صالة الحديد", en: "Strength floor" },
            { ar: "المسبح", en: "Pool" },
          ],
        },
      },
    });
  });

  it("نوع غير الاشتراك والإضافة مرفوض قبل أي حقل", () => {
    for (const kind of ["digital_program", "assessed_service", "", "session_pack"]) {
      expect(reasons(validateProductDraft({ ...INPUT, kind }))).toEqual({
        kind: "catalog.kind_invalid",
      });
    }
  });

  it.each(["Three", "three months", "-three", "three-", "three--months", "", "a".repeat(81)])(
    "المعرّف النصي «%s» مرفوض بنمط القيد",
    (slug) => {
      const result = validateProductDraft({ ...INPUT, slug });
      expect(slug === "Three" ? result.ok : reasons(result).slug === "catalog.slug_invalid").toBe(
        true,
      );
    },
  );

  it("كل أخطاء الحقول ترجع معًا، لا أولها فقط", () => {
    const result = validateProductDraft({
      ...INPUT,
      nameAr: "أ",
      nameEn: "",
      summaryAr: "ن".repeat(201),
      price: "abc",
      durationMonths: "0",
      bonusMonths: "13",
      sortOrder: "x",
    });
    expect(reasons(result)).toEqual({
      nameAr: "catalog.name_length",
      nameEn: "catalog.name_length",
      summaryAr: "catalog.summary_too_long",
      sortOrder: "catalog.sort_order_invalid",
      price: "amount.invalid_format",
      durationMonths: "catalog.duration_out_of_range",
      bonusMonths: "catalog.bonus_out_of_range",
    });
  });
});

describe("validateProductIdentity", () => {
  const identity = (change: Partial<ProductDraftInput>) =>
    validateProductIdentity("membership", { ...INPUT, ...change });

  it("اسم الفئة باللغتين معًا أو لا شيء", () => {
    expect(identity({ tierAr: "", tierEn: "" })).toMatchObject({ ok: true, value: { tier: null } });
    expect(reasons(identity({ tierEn: "" }))).toEqual({ tierEn: "catalog.tier_both_languages" });
    expect(reasons(identity({ tierAr: " " }))).toEqual({ tierAr: "catalog.tier_both_languages" });
    expect(reasons(identity({ tierAr: "ف".repeat(61) }))).toEqual({
      tierAr: "catalog.tier_too_long",
    });
  });

  it("الإضافة بلا اسم فئة ولو كُتب", () => {
    expect(validateProductIdentity("addon", INPUT)).toMatchObject({
      ok: true,
      value: { tier: null },
    });
  });

  it("الأسماء تُنظَّف: بلا محارف تحكم ولا علامات اتجاه، ومسافاتها واحدة", () => {
    const result = identity({ nameAr: "  3‏   أشهر\u0000 ", sortOrder: "" });
    expect(result).toMatchObject({ ok: true, value: { name: { ar: "3 أشهر" }, sortOrder: 0 } });
  });

  it("حدّا الاسم 2 و80", () => {
    expect(identity({ nameEn: "ab" }).ok).toBe(true);
    expect(identity({ nameEn: "a".repeat(80) }).ok).toBe(true);
    expect(identity({ nameEn: "a".repeat(81) }).ok).toBe(false);
    expect(identity({ sortOrder: "10000" }).ok).toBe(false);
  });
});

describe("validateProductTerms", () => {
  const terms = (change: Partial<ProductDraftInput>, kind: "membership" | "addon" = "membership") =>
    validateProductTerms(kind, { ...INPUT, ...change });

  it("السعر موجب وضمن حد int4، بأرقام عربية وفواصل", () => {
    expect(terms({ price: "١٬٤٩٩٫٥" })).toMatchObject({ ok: true, value: { priceMinor: 149_950 } });
    expect(reasons(terms({ price: "0" }))).toEqual({ price: "catalog.price_not_positive" });
    expect(reasons(terms({ price: "-5" }))).toEqual({ price: "amount.negative" });
    expect(reasons(terms({ price: "1.999" }))).toEqual({ price: "amount.too_many_decimals" });
    expect(reasons(terms({ price: String(MAX_AMOUNT_MINOR) }))).toEqual({
      price: "amount.too_large",
    });
  });

  it("المدة 1 إلى 36 والمجاني 0 إلى 12، والمجاني الفارغ صفر", () => {
    expect(terms({ durationMonths: "36", bonusMonths: "" })).toMatchObject({
      ok: true,
      value: { durationMonths: 36, bonusMonths: 0 },
    });
    expect(terms({ durationMonths: "37" }).ok).toBe(false);
    expect(terms({ durationMonths: "" }).ok).toBe(false);
    expect(terms({ durationMonths: "1.5" }).ok).toBe(false);
    expect(terms({ bonusMonths: "12" }).ok).toBe(true);
  });

  it("الإضافة بلا مدة ولا أشهر مجانية مهما كُتب", () => {
    expect(terms({ durationMonths: "abc", bonusMonths: "99" }, "addon")).toMatchObject({
      ok: true,
      value: { durationMonths: null, bonusMonths: 0 },
    });
  });

  it("الميزة باللغتين، وحتى 12 ميزة", () => {
    const one = { ar: "ميزة", en: "Benefit", sortOrder: "" };
    expect(reasons(terms({ benefits: [one, { ar: "ناقصة", en: "", sortOrder: "" }] }))).toEqual({
      benefit_1: "catalog.benefit_both_languages",
    });
    expect(terms({ benefits: Array.from({ length: 12 }, () => one) }).ok).toBe(true);
    expect(reasons(terms({ benefits: Array.from({ length: 13 }, () => one) }))).toEqual({
      benefits: "catalog.too_many_benefits",
    });
    expect(reasons(terms({ benefits: [{ ...one, ar: "م".repeat(121) }] }))).toEqual({
      benefit_0: "catalog.benefit_too_long",
    });
    expect(reasons(terms({ benefits: [{ ...one, sortOrder: "أول" }] }))).toEqual({
      benefit_0: "catalog.sort_order_invalid",
    });
  });

  it("بلا رقم ترتيب: الصفوف بموضعها في النموذج", () => {
    const rows = ["ج", "أ", "ب"].map((ar) => ({ ar, en: ar, sortOrder: "" }));
    const result = terms({ benefits: rows });
    expect(result.ok && result.value.benefits.map((benefit) => benefit.ar)).toEqual([
      "ج",
      "أ",
      "ب",
    ]);
  });
});
