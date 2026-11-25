import { describe, expect, it } from "vitest";
import { buildRss, escapeXml } from "./rss";

describe("escapeXml", () => {
  it("يهرّب المحارف الخاصة الخمسة ويحذف محارف التحكم", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
    expect(escapeXml("a\u0000b\u0008c\nd")).toBe("abc\nd");
    expect(escapeXml("نادي «مسار»")).toBe("نادي «مسار»");
  });
});

describe("buildRss", () => {
  const xml = buildRss({
    title: "مدونة <النادي>",
    url: "https://example.com/blog",
    feedUrl: "https://example.com/blog/feed.xml",
    description: "وصف & تفاصيل",
    language: "ar",
    items: [
      {
        title: "</title><script>",
        url: "https://example.com/blog/a?x=1&y=2",
        description: "وصف",
        publishedAt: "2026-11-01",
      },
      {
        title: "ب",
        url: "https://example.com/blog/b",
        description: "د",
        publishedAt: "2026-11-20",
      },
    ],
  });

  it("RSS 2.0 بعنصر لكل مقال وتواريخ RFC 822", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<pubDate>Sun, 01 Nov 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<lastBuildDate>Fri, 20 Nov 2026 00:00:00 GMT</lastBuildDate>");
  });

  it("لا نص خام يكسر البنية", () => {
    expect(xml).toContain("<title>&lt;/title&gt;&lt;script&gt;</title>");
    expect(xml).toContain("<title>مدونة &lt;النادي&gt;</title>");
    expect(xml).toContain("https://example.com/blog/a?x=1&amp;y=2");
    expect(xml).not.toContain("<script>");
  });
});

describe("buildRss: الترتيب", () => {
  const item = (slug: string, publishedAt: string) => ({
    title: slug,
    url: `https://example.com/blog/${slug}`,
    description: "و",
    publishedAt,
  });

  it("الأحدث نشرًا أولًا مهما كان ترتيب المدخلات", () => {
    const xml = buildRss({
      title: "م",
      url: "https://example.com/blog",
      feedUrl: "https://example.com/blog/feed.xml",
      description: "و",
      language: "ar",
      items: [item("old", "2026-01-05"), item("new", "2026-11-20"), item("mid", "2026-06-01")],
    });
    const order = [...xml.matchAll(/<item><title>(\w+)<\/title>/gu)].map((match) => match[1]);
    expect(order).toEqual(["new", "mid", "old"]);
    expect(xml).toContain("<lastBuildDate>Fri, 20 Nov 2026 00:00:00 GMT</lastBuildDate>");
  });
});
