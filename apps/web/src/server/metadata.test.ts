import { describe, expect, it } from "vitest";
import { alternateLanguages, buildPageMetadata } from "./metadata";

const ORIGIN = "https://example.com";

describe("alternateLanguages (hreflang)", () => {
  it("كل اللغات افتراضيًا، والعربية بلا بادئة هي x-default", () => {
    expect(alternateLanguages(ORIGIN, "/memberships")).toEqual({
      ar: `${ORIGIN}/memberships`,
      en: `${ORIGIN}/en/memberships`,
      "x-default": `${ORIGIN}/memberships`,
    });
  });

  it("ترجمة واحدة ⇒ لا ذكر للغة غير موجودة", () => {
    expect(alternateLanguages(ORIGIN, "/blog/a", ["ar"])).toEqual({
      ar: `${ORIGIN}/blog/a`,
      "x-default": `${ORIGIN}/blog/a`,
    });
  });

  it("مقال إنجليزي فقط ⇒ x-default إلى الإنجليزية", () => {
    expect(alternateLanguages(ORIGIN, "/blog/a", ["en"])).toEqual({
      en: `${ORIGIN}/en/blog/a`,
      "x-default": `${ORIGIN}/en/blog/a`,
    });
  });

  it("الرئيسية: الإنجليزية ‎/en‎ بلا شرطة أخيرة", () => {
    expect(alternateLanguages(ORIGIN, "/").en).toBe(`${ORIGIN}/en`);
  });
});

describe("buildPageMetadata", () => {
  it("متوافق مع السابق: صفحة عادية بنوع website وبلا robots", () => {
    const metadata = buildPageMetadata(ORIGIN, {
      locale: "en",
      path: "/memberships",
      title: "T",
      description: "D",
    });
    expect(metadata.alternates?.canonical).toBe(`${ORIGIN}/en/memberships`);
    expect(metadata.openGraph).toMatchObject({ type: "website", url: `${ORIGIN}/en/memberships` });
    expect(metadata.robots).toBeUndefined();
  });

  it("المقال: OpenGraph article بتاريخي النشر والتعديل", () => {
    const metadata = buildPageMetadata(ORIGIN, {
      locale: "ar",
      path: "/blog/a",
      title: "T",
      description: "D",
      locales: ["ar"],
      article: { publishedTime: "2026-11-01", modifiedTime: "2026-11-10" },
    });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-11-01",
      modifiedTime: "2026-11-10",
    });
    expect(metadata.alternates?.languages).toEqual({
      ar: `${ORIGIN}/blog/a`,
      "x-default": `${ORIGIN}/blog/a`,
    });
  });

  it("المسودة: noindex صريح", () => {
    const metadata = buildPageMetadata(ORIGIN, {
      locale: "ar",
      path: "/blog/a",
      title: "T",
      description: "D",
      noindex: true,
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
