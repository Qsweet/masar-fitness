import { money, type MembershipPlan } from "@masar/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultDictionary } from "@/i18n/dictionaries";
import { toPlanViews } from "./plan-view";
import { PlansSection } from "./plans-section";

/**
 * ADMIN_A2_SALES §4.3 و§13 (WP7): أرشفة آخر باقة تترك صفحة الاشتراكات بلا باقات. الصفحة لا ترد 404
 * (لا `notFound` على قائمة فارغة) والقسم يعرض حالة فارغة توجّه إلى واتساب بدل محدِّد بلا خيارات.
 * قاعدة اختبارات المتصفح مشتركة بباقات حقيقية، فالحالة تُثبت هنا برسم القسم نفسه.
 */
function render(locale: "ar" | "en", catalog: readonly MembershipPlan[] = []): string {
  const dictionary = defaultDictionary(locale);
  const html = renderToStaticMarkup(
    createElement(PlansSection, {
      plans: toPlanViews(catalog, locale, false),
      locale,
      dictionary,
      backdrop: false,
    }),
  );
  // React يرمّز الفاصلة العليا في النص («we'll»)
  return html.replaceAll("&#x27;", "'");
}

describe("قسم الاشتراكات بلا باقات", () => {
  it("حالة فارغة باللغتين برابط واتساب، بلا محدِّد ولا زر شراء", () => {
    for (const locale of ["ar", "en"] as const) {
      const { plans } = defaultDictionary(locale);
      const html = render(locale);
      expect(html).toContain(plans.emptyTitle);
      expect(html).toContain(plans.emptyLead);
      expect(html).toContain(plans.emptyAction);
      expect(html).toContain("wa.me");
      expect(html).not.toContain("<form");
      expect(html).not.toContain('type="radio"');
    }
  });
});

function plan(slug: string, amountMinor: number, paidMonths: number, bonusMonths: number) {
  const value: MembershipPlan = {
    slug,
    name: { ar: slug, en: slug },
    tier: null,
    summary: { ar: "", en: "" },
    price: money(amountMinor),
    paidMonths,
    bonusMonths,
    benefits: [],
  };
  return value;
}

describe("المحدِّد كما يصل بلا JavaScript", () => {
  const catalog = [plan("three", 69_900, 3, 1), plan("twelve", 149_900, 12, 2)];

  it("راديو حقيقي لكل اشتراك والأوفر مختار، ونسخة كاملة لكل اشتراك بزر شرائه في الصفحة", () => {
    const html = render("ar", catalog);
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toMatch(/<input type="radio"[^>]*checked=""[^>]*value="twelve"/);
    expect(html).not.toMatch(/<input type="radio"[^>]*checked=""[^>]*value="three"/);
    // لكل اشتراك نسخته في المناطق الثلاث المتغيرة (الهوية والسعر، التجميد، الشراء)
    expect(html.match(/data-plan="three"/g)).toHaveLength(3);
    expect(html.match(/data-plan="twelve"/g)).toHaveLength(3);
    // زر شراء كل اشتراك رابط واتساب يسمّيه، فالاختيار بالـCSS وحده يصل إلى الشراء الصحيح
    expect(html.match(/href="https:\/\/wa\.me\/[^"]*"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("تدفع شهريًا نحو 107\u00a0ر.س بدل 175\u00a0ر.س في three");
    expect(html).toContain('role="img" aria-label="14 شهرًا، منها شهران مجانًا"');
  });
});
