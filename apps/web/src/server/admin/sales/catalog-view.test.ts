import type { CatalogProductDetail, CatalogVersionRow } from "@masar/db";
import { money, type MembershipPlan } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { toPlanViews } from "@/components/plans/plan-view";
import { getAdminDictionary } from "@/i18n/admin";
import {
  bestValueSlug,
  formatRate,
  includedVat,
  planOf,
  previewView,
  termsReview,
  withPreviewed,
} from "./catalog-view";

const text = getAdminDictionary().sales.plans;
const BENEFITS = [{ ar: "المسبح", en: "Pool" }];

function version(overrides: Partial<CatalogVersionRow> = {}): CatalogVersionRow {
  return {
    id: "v1",
    price: money(69_900),
    durationMonths: 3,
    bonusMonths: 1,
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validUntil: null,
    soldItems: 0,
    current: true,
    benefits: BENEFITS,
    ...overrides,
  };
}

function product(overrides: Partial<CatalogProductDetail> = {}): CatalogProductDetail {
  const current = version();
  return {
    id: "p1",
    slug: "three-months",
    kind: "membership",
    name: { ar: "3 أشهر", en: "3 months" },
    summary: { ar: "وصف", en: "Summary" },
    tier: { ar: "انطلاقة الأبطال", en: "Champions' Start" },
    sortOrder: 0,
    status: "draft",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    versions: [current],
    currentVersion: current,
    sellable: false,
    soldItems: 0,
    links: [],
    pendingOrders: 2,
    lockToken: "1:v1",
    ...overrides,
  };
}

function plan(slug: string, amountMinor: number, paidMonths: number): MembershipPlan {
  return {
    slug,
    name: { ar: slug, en: slug },
    tier: null,
    summary: { ar: "", en: "" },
    price: money(amountMinor),
    paidMonths,
    bonusMonths: 0,
    benefits: BENEFITS,
  };
}

const SIX = plan("six-months", 99_900, 6);
const YEAR = plan("one-year", 149_900, 12);

describe("معاينة البطاقة", () => {
  it("نموذج العرض يساوي toPlanViews العام للمدخل نفسه، باللغتين", () => {
    const draft = planOf(product());
    if (draft === undefined) {
      throw new Error("fixture");
    }
    for (const locale of ["ar", "en"] as const) {
      const expected = toPlanViews([SIX, YEAR, draft], locale, false).find(
        (view) => view.slug === draft.slug,
      );
      expect(previewView([SIX, YEAR], draft, locale)).toEqual(expected);
      expect(expected?.tier).toBe(locale === "ar" ? "انطلاقة الأبطال" : "Champions' Start");
    }
  });

  it("باقة منشورة تحل محل نفسها في موضعها، ومسودة تُضاف في الآخر", () => {
    const changed = { ...SIX, price: money(50_000) };
    expect(withPreviewed([SIX, YEAR], changed)).toEqual([changed, YEAR]);
    const draft = plan("new-plan", 10_000, 1);
    expect(withPreviewed([SIX, YEAR], draft)).toEqual([SIX, YEAR, draft]);
  });

  it("شارة «الأكثر قيمة» تُحسب بين المعروضات مع هذه الباقة بسعرها الحالي", () => {
    expect(previewView([SIX, YEAR], YEAR, "ar")?.isBestValue).toBe(true);
    expect(previewView([SIX, YEAR], SIX, "ar")?.isBestValue).toBe(false);
    const cheap = plan("new-plan", 10_000, 12);
    expect(previewView([SIX, YEAR], cheap, "ar")?.isBestValue).toBe(true);
    // باقة وحيدة بلا مقارنة: لا شارة، كما في الموقع
    expect(previewView([], SIX, "ar")?.isBestValue).toBe(false);
    expect(bestValueSlug([SIX, YEAR])).toBe("one-year");
    expect(bestValueSlug([SIX])).toBeUndefined();
  });

  it("لا معاينة لإضافة، ولا لمنتج بلا نسخة سارية أو بلا مدة", () => {
    expect(planOf(product({ kind: "addon" }))).toBeUndefined();
    expect(planOf(product({ currentVersion: null }))).toBeUndefined();
    expect(planOf(product({ currentVersion: version({ durationMonths: null }) }))).toBeUndefined();
  });
});

describe("الضريبة والنسبة", () => {
  it("ما منه ضريبة يُستخرج من السعر الشامل بدالة المجال", () => {
    expect(includedVat(money(149_900), 1500).amountMinor).toBe(19_552);
    expect(includedVat(money(149_900), 0).amountMinor).toBe(0);
  });

  it("النسبة بلا أصفار زائدة", () => {
    expect([1500, 1250, 1, 10_000, 505].map(formatRate)).toEqual([
      "15%",
      "12.5%",
      "0.01%",
      "100%",
      "5.05%",
    ]);
  });
});

describe("مراجعة تغيير الشروط على منتج منشور", () => {
  const terms = { priceMinor: 79_900, durationMonths: 3, bonusMonths: 1, benefits: BENEFITS };

  it("السعر وحده: القديم والجديد، وعدد الطلبات المعلّقة", () => {
    expect(termsReview(product(), terms, text)).toEqual([
      ["السعر الحالي", "699 ر.س"],
      ["السعر الجديد", "799 ر.س"],
      ["طلبات معلّقة تبقى بسعرها حتى مهلتها", "2"],
    ]);
  });

  it("المدة والمجاني والمزايا حين تتغير", () => {
    const next = { priceMinor: 69_900, durationMonths: 6, bonusMonths: 0, benefits: [] };
    expect(termsReview(product(), next, text)).toEqual([
      ["المدة الحالية", "3 أشهر"],
      ["المدة الجديدة", "6 أشهر"],
      ["الأشهر المجانية الحالية", "شهر"],
      ["الأشهر المجانية الجديدة", "لا يوجد"],
      ["المزايا", "تتغير"],
      ["طلبات معلّقة تبقى بسعرها حتى مهلتها", "2"],
    ]);
  });

  it("إضافة: لا أسطر مدة", () => {
    const addon = product({
      kind: "addon",
      currentVersion: version({ durationMonths: null, bonusMonths: 0 }),
    });
    const next = { priceMinor: 6_000, durationMonths: null, bonusMonths: 0, benefits: BENEFITS };
    expect(termsReview(addon, next, text).map(([label]) => label)).toEqual([
      "السعر الحالي",
      "السعر الجديد",
      "طلبات معلّقة تبقى بسعرها حتى مهلتها",
    ]);
  });
});
