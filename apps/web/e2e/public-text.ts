import type { Page } from "@playwright/test";

/**
 * نص الصفحة العامة كما يراه الزائر ومحركات البحث، لمقارنته بلقطة محفوظة (ADMIN_A3_CONTENT §11، WP2):
 * العنوان والوصف والروابط المعتمدة وبيانات JSON-LD، ونص الجسم، وكل سمة تحمل نصًا (البديل والتسمية
 * والرابط). المناطق التي يملؤها الكتالوج من القاعدة تُحذف قبل القراءة: اختبارات اللوحة المتوازية
 * تنشر باقات أندية اختبار يقرؤها الموقع العام، فتتغير بلا علاقة بالمحتوى.
 */
const CATALOG_REGIONS = ["#plans", "#compare", "#plan-summary"];
const TEXT_ATTRIBUTES = ["alt", "aria-label", "title", "placeholder", "href", "content"];

export interface PublicText {
  readonly title: string;
  readonly head: readonly string[];
  readonly jsonLd: readonly string[];
  readonly body: string;
  readonly attributes: readonly string[];
}

export function publicText(page: Page): Promise<PublicText> {
  return page.evaluate(
    ({ regions, attributes }) => {
      const squash = (value: string): string => value.replace(/\s+/g, " ").trim();
      const head = Array.from(
        document.head.querySelectorAll("meta[name], meta[property], link[rel]"),
      )
        .filter((node) => !/stylesheet|preload|icon/.test(node.getAttribute("rel") ?? ""))
        .map((node) =>
          ["name", "property", "rel", "hreflang", "content", "href"]
            .map((name) => node.getAttribute(name))
            .filter((value) => value !== null)
            .join(" "),
        )
        // ترتيب وسوم الرأس يتغير مع البث؛ المحتوى هو المقارَن
        .sort();
      const jsonLd = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
        (node) => node.textContent,
      );
      const body = document.body.cloneNode(true) as HTMLElement;
      // العرض مع قسم الباقات يُقرأ وحده: نصه من القاموس لا من الكتالوج
      const friends = body.querySelector("#friends");
      body.querySelectorAll(regions.join(",")).forEach((node) => {
        node.remove();
      });
      if (friends !== null) {
        body.append(friends);
      }
      body.querySelectorAll("script, style, template").forEach((node) => {
        node.remove();
      });
      const values = Array.from(body.querySelectorAll("*")).flatMap((node) =>
        attributes
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value !== null && !value.startsWith("/_next/")),
      );
      return {
        title: document.title,
        head,
        jsonLd,
        body: squash(body.textContent),
        attributes: values,
      };
    },
    { regions: CATALOG_REGIONS, attributes: TEXT_ATTRIBUTES },
  );
}
