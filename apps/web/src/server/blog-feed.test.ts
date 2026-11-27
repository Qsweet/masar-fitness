import { describe, expect, it } from "vitest";
import { article, draft, translation } from "@/test/blog-fixtures";
import { blogFeed } from "./blog-feed";
import { defaultDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import type { Article } from "@/content/blog/types";

const feed = (locale: Locale, articles: readonly Article[]) =>
  blogFeed(ORIGIN, locale, articles, defaultDictionary(locale));

const ORIGIN = "https://example.com";

function titles(xml: string | undefined): string[] {
  return [...(xml ?? "").matchAll(/<item><title>([^<]+)<\/title>/gu)].map(
    (match) => match[1] ?? "",
  );
}

describe("blogFeed", () => {
  it("منشور ومسودة معًا: المنشور في الخلاصة والمسودة لا", () => {
    const xml = feed("ar", [
      article({ slug: "live", translations: { ar: translation({ title: "منشور" }) } }),
      draft({ slug: "secret", translations: { ar: translation({ title: "مسودة" }) } }),
    ]);
    expect(titles(xml)).toEqual(["منشور"]);
    expect(xml).toContain(`<link>${ORIGIN}/blog/live</link>`);
    expect(xml).not.toContain("secret");
    expect(xml).toContain(`<atom:link href="${ORIGIN}/blog/feed.xml"`);
  });

  it("مرتبة بتاريخ النشر لا بتاريخ التحديث", () => {
    const xml = feed("en", [
      article({
        slug: "older-but-updated",
        publishedAt: "2026-01-01",
        updatedAt: "2026-11-20",
        translations: { en: translation({ title: "Older" }) },
      }),
      article({
        slug: "newer",
        publishedAt: "2026-11-01",
        updatedAt: "2026-11-01",
        translations: { en: translation({ title: "Newer" }) },
      }),
    ]);
    expect(titles(xml)).toEqual(["Newer", "Older"]);
    expect(xml).toContain(`<link>${ORIGIN}/en/blog/newer</link>`);
  });

  it("مسودات فقط، أو لا ترجمة منشورة بهذه اللغة ⇒ لا خلاصة", () => {
    expect(feed("ar", [draft()])).toBeUndefined();
    expect(feed("en", [article()])).toBeUndefined();
  });
});
