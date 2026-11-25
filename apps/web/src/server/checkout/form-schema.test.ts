import { describe, expect, it } from "vitest";
import { isSlug, parseCheckoutForm, parseCheckoutOptions, typedValues } from "./form-schema";

const KEY = "0b6c1a52-8f0e-4c55-9a43-2f8f8d7c1e11";

function formData(overrides: Record<string, string | string[] | undefined> = {}): FormData {
  const fields: Record<string, string | string[] | undefined> = {
    name: "محمد",
    mobile: "0551234567",
    coupon: "",
    idempotencyKey: KEY,
    quotedTotalMinor: "280000",
    locale: "ar",
    slug: "one-year",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of value === undefined ? [] : [value].flat()) {
      data.append(key, item);
    }
  }
  return data;
}

describe("مخطط نموذج الشراء", () => {
  it("يقبل النموذج السليم ويحوّل الإجمالي إلى عدد صحيح والإضافات إلى مصفوفة", () => {
    const result = parseCheckoutForm(formData({ addon: ["demo-addon"] }));
    expect(result).toEqual({
      ok: true,
      value: {
        name: "محمد",
        mobile: "0551234567",
        coupon: "",
        idempotencyKey: KEY,
        quotedTotalMinor: 280_000,
        addons: ["demo-addon"],
        locale: "ar",
        slug: "one-year",
      },
    });
  });

  it("غياب الكوبون يعني نصًا فارغًا", () => {
    const result = parseCheckoutForm(formData({ coupon: undefined }));
    expect(result.ok && result.value.coupon).toBe("");
  });

  it("مفتاح ليس UUID خطأ عام على النموذج", () => {
    expect(parseCheckoutForm(formData({ idempotencyKey: "not-a-uuid" }))).toEqual({
      ok: false,
      errors: { form: "form.invalid" },
    });
  });

  it("الأطوال: اسم وجوال وكوبون أطول من الحد أخطاء على حقولها", () => {
    const result = parseCheckoutForm(
      formData({ name: "ا".repeat(201), mobile: "5".repeat(33), coupon: "A".repeat(65) }),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        name: "buyer.name_too_long",
        mobile: "mobile.not_saudi_mobile",
        coupon: "coupon.invalid_format",
      },
    });
  });

  it("الحد بالضبط مقبول: اسم 200 وجوال 32 وكوبون 64", () => {
    const result = parseCheckoutForm(
      formData({ name: "ا".repeat(200), mobile: "5".repeat(32), coupon: "A".repeat(64) }),
    );
    expect(result.ok).toBe(true);
  });

  it("أكثر من خمس إضافات مرفوض، وخمس مقبولة", () => {
    const five = ["a1", "a2", "a3", "a4", "a5"];
    expect(parseCheckoutForm(formData({ addon: five })).ok).toBe(true);
    expect(parseCheckoutForm(formData({ addon: [...five, "a6"] }))).toEqual({
      ok: false,
      errors: { form: "form.invalid" },
    });
  });

  it("الإجمالي السالب أو الكسري أو فوق int4، واللغة والـslug الغريبان: مرفوضة", () => {
    for (const overrides of [
      { quotedTotalMinor: "-1" },
      { quotedTotalMinor: "1.5" },
      { quotedTotalMinor: "2147483648" },
      { quotedTotalMinor: undefined },
      { locale: "fr" },
      { slug: "../etc" },
      { addon: ["Bad Slug"] },
    ]) {
      expect(parseCheckoutForm(formData(overrides)).ok, JSON.stringify(overrides)).toBe(false);
    }
  });

  it("القيم المكتوبة تُعاد كما هي مقصوصة على الحد", () => {
    expect(typedValues(formData({ name: "ب".repeat(250) })).name).toHaveLength(200);
    expect(typedValues(new FormData())).toEqual({ name: "", mobile: "" });
  });
});

describe("خيارات صفحة الشراء من الرابط", () => {
  it("إضافة واحدة أو متكررة، والمكرر يُدمج، والكوبون أول قيمة", () => {
    expect(parseCheckoutOptions({ addon: "demo-addon", coupon: ["demo10", "x"] })).toEqual({
      addonSlugs: ["demo-addon"],
      couponInput: "demo10",
    });
    expect(parseCheckoutOptions({ addon: ["a1", "a1", "a2"] })).toEqual({
      addonSlugs: ["a1", "a2"],
      couponInput: "",
    });
  });

  it("slug إضافة بشكل غريب ⇒ undefined (404)", () => {
    expect(parseCheckoutOptions({ addon: ["ok", "Not OK"] })).toBeUndefined();
    expect(parseCheckoutOptions({ addon: "a".repeat(81) })).toBeUndefined();
    expect(isSlug("one-year")).toBe(true);
    expect(isSlug("one--year")).toBe(false);
  });

  it("الكوبون الضخم يُقص بعد الحد بمحرف فيبقى مرفوض الصيغة", () => {
    expect(parseCheckoutOptions({ coupon: "A".repeat(500) })?.couponInput).toHaveLength(65);
  });
});
