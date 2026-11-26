import { describe, expect, it } from "vitest";
import { article, draft, translation } from "@/test/blog-fixtures";
import { sitemapEntries } from "./sitemap-entries";

const ORIGIN = "https://example.com";

function urls(entries: ReturnType<typeof sitemapEntries>): string[] {
  return entries.map((entry) => entry.url);
}

describe("sitemapEntries", () => {
  it("بلا مقالات: الصفحات الثابتة والاشتراكات باللغتين، ولا مدونة", () => {
    const entries = sitemapEntries({ origin: ORIGIN, planSlugs: ["one-year"], articles: [] });
    expect(urls(entries)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/en`,
      `${ORIGIN}/memberships`,
      `${ORIGIN}/en/memberships`,
      `${ORIGIN}/memberships/one-year`,
      `${ORIGIN}/en/memberships/one-year`,
      `${ORIGIN}/tools/cost-per-visit`,
      `${ORIGIN}/en/tools/cost-per-visit`,
    ]);
    expect(entries[0]?.lastModified).toBeUndefined();
    expect(entries[0]?.alternates?.languages).toEqual({
      ar: `${ORIGIN}/`,
      en: `${ORIGIN}/en`,
      "x-default": `${ORIGIN}/`,
    });
  });

  it("المسودات لا تظهر أبدًا، والمنشور بترجماته الحقيقية وتاريخ تحديثه", () => {
    const entries = sitemapEntries({
      origin: ORIGIN,
      planSlugs: [],
      articles: [article({ slug: "live", updatedAt: "2026-11-12" }), draft({ slug: "secret" })],
    });
    expect(urls(entries).some((url) => url.includes("secret"))).toBe(false);
    const live = entries.filter((entry) => entry.url.includes("/blog/live"));
    expect(live).toEqual([
      {
        url: `${ORIGIN}/blog/live`,
        lastModified: "2026-11-12",
        alternates: {
          languages: { ar: `${ORIGIN}/blog/live`, "x-default": `${ORIGIN}/blog/live` },
        },
      },
    ]);
    const index = entries.filter((entry) => entry.url.endsWith("/blog"));
    expect(index).toEqual([
      expect.objectContaining({ url: `${ORIGIN}/blog`, lastModified: "2026-11-12" }),
    ]);
  });

  it("مقال بلغتين: رابطان ببدائل متبادلة", () => {
    const both = article({ translations: { ar: translation(), en: translation() } });
    const entries = sitemapEntries({ origin: ORIGIN, planSlugs: [], articles: [both] });
    const versions = entries.filter((entry) => entry.url.includes(both.slug));
    expect(versions.map((entry) => entry.url)).toEqual([
      `${ORIGIN}/blog/${both.slug}`,
      `${ORIGIN}/en/blog/${both.slug}`,
    ]);
    expect(versions[0]?.alternates).toEqual(versions[1]?.alternates);
  });

  it("مسودات فقط ⇒ لا فهرس مدونة", () => {
    const entries = sitemapEntries({ origin: ORIGIN, planSlugs: [], articles: [draft()] });
    expect(urls(entries).some((url) => url.includes("/blog"))).toBe(false);
  });
});

describe("لوحة التحكم خارج خريطة الموقع", () => {
  it("لا رابط يبدأ بـ/admin مهما كانت المدخلات", () => {
    const entries = sitemapEntries({
      origin: "https://example.com",
      planSlugs: ["admin"],
      articles: [],
    });
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths.some((path) => path === "/admin" || path.startsWith("/admin/"))).toBe(false);
  });
});
