import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultDictionary } from "@/i18n/dictionaries";
import { PlansSection } from "./plans-section";

/**
 * ADMIN_A2_SALES §4.3 و§13 (WP7): أرشفة آخر باقة تترك صفحة الاشتراكات بلا باقات. الصفحة لا ترد 404
 * (لا `notFound` على قائمة فارغة) والقسم يعرض حالة فارغة توجّه إلى واتساب بدل محدِّد بلا خيارات.
 * قاعدة اختبارات المتصفح مشتركة بباقات حقيقية، فالحالة تُثبت هنا برسم القسم نفسه.
 */
function render(locale: "ar" | "en"): string {
  const dictionary = defaultDictionary(locale);
  const html = renderToStaticMarkup(
    createElement(PlansSection, {
      plans: [],
      locale,
      dictionary,
      revealAfterId: "intro",
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
