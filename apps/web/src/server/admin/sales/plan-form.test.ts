import type { CatalogProductDetail } from "@masar/db";
import { money, validateProductDraft } from "@masar/domain";
import { describe, expect, it } from "vitest";
import {
  BENEFIT_ROWS,
  benefitField,
  benefitRowCount,
  CREATE_LIMITS,
  draftInput,
  identityValues,
  termsInput,
  termsValues,
} from "./plan-form";

const VALUES = {
  kind: "membership",
  slug: "six-months",
  nameAr: "6 أشهر",
  nameEn: "6 months",
  summaryAr: "وصف",
  summaryEn: "Summary",
  tierAr: "",
  tierEn: "",
  sortOrder: "1",
  price: "999",
  durationMonths: "6",
  bonusMonths: "2",
  [benefitField("ar", 0)]: "المسبح",
  [benefitField("en", 0)]: "Pool",
  [benefitField("order", 0)]: "",
};

describe("حقول نموذج المنتج", () => {
  it("حدود الإنشاء تشمل كل حقل وكل صف مزايا", () => {
    const names = Object.keys(CREATE_LIMITS);
    expect(names).toEqual(
      expect.arrayContaining(["kind", "slug", "nameAr", "price", "bonusMonths"]),
    );
    expect(names.filter((name) => name.startsWith("benefit_"))).toHaveLength(BENEFIT_ROWS * 3);
  });

  it("قيم النموذج ← مدخل المجال، والمجال يقبلها", () => {
    const input = draftInput(VALUES);
    expect(input.benefits).toHaveLength(BENEFIT_ROWS);
    expect(input.benefits[0]).toEqual({ ar: "المسبح", en: "Pool", sortOrder: "" });
    const draft = validateProductDraft(input);
    expect(draft).toMatchObject({
      ok: true,
      value: { slug: "six-months", terms: { priceMinor: 99_900, benefits: [{ ar: "المسبح" }] } },
    });
    expect(termsInput({}).price).toBe("");
  });

  it("خاصية موروثة ليست حقلًا", () => {
    expect(draftInput({}).nameAr).toBe("");
    expect(Object.keys(draftInput({ constructor: "x" }))).not.toContain("constructor");
  });

  it("صفوف المزايا: المكتوب وصفّان فارغان، وثلاثة على الأقل، والحد الأقصى", () => {
    expect(benefitRowCount({})).toBe(3);
    expect(benefitRowCount(VALUES)).toBe(3);
    expect(benefitRowCount({ [benefitField("en", 4)]: "Sauna" })).toBe(7);
    expect(benefitRowCount({ [benefitField("ar", 11)]: "آخر" })).toBe(BENEFIT_ROWS);
  });

  it("قيم النموذج من منتج قائم: السعر بالريال كما يُكتب، والمزايا بترتيبها", () => {
    const version = {
      id: "v1",
      price: money(149_950),
      durationMonths: 12,
      bonusMonths: 2,
      validFrom: new Date(0),
      validUntil: null,
      soldItems: 0,
      current: true,
      benefits: [
        { ar: "المسبح", en: "Pool" },
        { ar: "الساونا", en: "Sauna" },
      ],
    };
    const product = {
      name: { ar: "سنة", en: "Year" },
      summary: { ar: "وصف", en: "Summary" },
      tier: null,
      sortOrder: 4,
      currentVersion: version,
    } as unknown as CatalogProductDetail;
    expect(identityValues(product)).toEqual({
      nameAr: "سنة",
      nameEn: "Year",
      summaryAr: "وصف",
      summaryEn: "Summary",
      tierAr: "",
      tierEn: "",
      sortOrder: "4",
    });
    const terms = termsValues(product);
    expect(terms).toMatchObject({ price: "1,499.50", durationMonths: "12", bonusMonths: "2" });
    expect(terms[benefitField("ar", 1)]).toBe("الساونا");
    expect(terms[benefitField("order", 1)]).toBe("2");
    // ما يُعرض في الحقل يقبله المجال كما هو
    expect(validateProductDraft(draftInput({ ...VALUES, ...terms }))).toMatchObject({
      ok: true,
      value: { terms: { priceMinor: 149_950, durationMonths: 12 } },
    });
    const empty = termsValues({ ...product, currentVersion: null });
    expect(empty).toEqual({ price: "", durationMonths: "", bonusMonths: "" });
  });
});
