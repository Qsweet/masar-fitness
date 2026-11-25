import { describe, expect, it } from "vitest";
import { ARTICLES } from "@/content/blog/site";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { lintArticle, lintTree } from "./copy-lint";

describe("تدقيق النصوص الحقيقية", () => {
  it("القاموس العربي بلا مخالفات", () => {
    expect(lintTree(ar, "ar")).toEqual([]);
  });

  it("القاموس الإنجليزي بلا مخالفات", () => {
    expect(lintTree(en, "en")).toEqual([]);
  });

  it("كل المقالات بلا مخالفات", () => {
    expect(ARTICLES.flatMap(lintArticle)).toEqual([]);
  });
});
