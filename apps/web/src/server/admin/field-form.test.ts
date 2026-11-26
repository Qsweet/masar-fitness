import { DomainError } from "@masar/domain";
import { describe, expect, it } from "vitest";
import {
  failureOf,
  formIntent,
  initialFieldForm,
  readFormValues,
  rejectedForm,
  reviewForm,
} from "./field-form";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

describe("حالة نماذج الحقول", () => {
  it("أخطاء الحقول تُعرض كلٌّ بجانب حقله، وخطأ العمل على النموذج أو على حقله", () => {
    expect(
      failureOf([
        { field: "price", reason: "amount.negative" },
        { field: "slug", reason: "catalog.slug_invalid" },
      ]),
    ).toEqual({ error: null, fields: { price: "amount.negative", slug: "catalog.slug_invalid" } });
    expect(failureOf(new DomainError("conflict", "catalog.stale_edit"))).toEqual({
      error: "catalog.stale_edit",
      fields: {},
    });
    expect(failureOf(new DomainError("conflict", "catalog.slug_taken", { field: "slug" }))).toEqual(
      {
        error: null,
        fields: { slug: "catalog.slug_taken" },
      },
    );
  });

  it("الرفض يعيد ما كُتب، والمراجعة تعيده مع ما سيُنفَّذ، وكل رد بطابع جديد", () => {
    const values = { price: "abc" };
    const rejected = rejectedForm(values, {
      error: null,
      fields: { price: "amount.invalid_format" },
    });
    expect(rejected).toMatchObject({
      step: "edit",
      values,
      fields: { price: "amount.invalid_format" },
    });
    expect(rejected.stamp).toBeGreaterThan(initialFieldForm(values).stamp);
    const review = reviewForm(values, [["السعر الجديد", "1,000 ر.س"]]);
    expect(review).toMatchObject({ step: "confirm", values, error: null, fields: {} });
    expect(review.review).toEqual([["السعر الجديد", "1,000 ر.س"]]);
  });

  it("الحقل الأطول من حده يُعامل فارغًا لا مقصوصًا، والحقل الغائب فارغ، وغير المسمّى يُهمل", () => {
    const data = formData({ slug: "abc", nameAr: "x".repeat(11), extra: "ignored" });
    expect(readFormValues(data, { slug: 10, nameAr: 10, nameEn: 10 })).toEqual({
      slug: "abc",
      nameAr: "",
      nameEn: "",
    });
  });

  it("النية من زر الإرسال، والمجهول حفظ", () => {
    expect(formIntent(formData({ intent: "confirm" }))).toBe("confirm");
    expect(formIntent(formData({ intent: "edit" }))).toBe("edit");
    expect(formIntent(formData({ intent: "delete" }))).toBe("save");
    expect(formIntent(formData({}))).toBe("save");
  });
});
