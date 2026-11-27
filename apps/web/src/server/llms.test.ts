import { describe, expect, it } from "vitest";
import { article, draft, translation } from "@/test/blog-fixtures";
import { buildLlmsTxt } from "./llms";
import { defaultDictionary } from "@/i18n/dictionaries";
import type { Article } from "@/content/blog/types";

const llms = (articles: readonly Article[]) =>
  buildLlmsTxt(ORIGIN, articles, { ar: defaultDictionary("ar"), en: defaultDictionary("en") });

const ORIGIN = "https://example.com";

describe("buildLlmsTxt", () => {
  it("حقائق النادي وروابط الصفحات باللغتين", () => {
    const text = llms([]);
    expect(text.startsWith("# مسار الأبطال الرياضي\n\n> ")).toBe(true);
    expect(text).toContain("بريدة 52581");
    expect(text).toContain("+966163240111");
    expect(text).toContain(`- [العضويات](${ORIGIN}/memberships)`);
    expect(text).toContain(`(${ORIGIN}/en/tools/cost-per-visit)`);
    expect(text).not.toContain("/blog");
  });

  it("المقالات المنشورة فقط بلغتها", () => {
    const text = llms([
      article({ slug: "live", translations: { ar: translation({ title: "منشور" }) } }),
      draft({ slug: "secret" }),
    ]);
    expect(text).toContain(`- [منشور](${ORIGIN}/blog/live): وصف قصير للمقال.`);
    expect(text).not.toContain("secret");
    expect(text).not.toContain("/en/blog");
  });
});
