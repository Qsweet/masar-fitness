import { describe, expect, it } from "vitest";
import { defaultDictionary } from "@/i18n/dictionaries";
import { articleCrumbs } from "./crumbs";

describe("articleCrumbs", () => {
  it("الرئيسية ← المدونة ← المقال نفسه، آخره عنوان الصفحة الحالية", () => {
    expect(articleCrumbs(defaultDictionary("en"), "Title", "a-slug")).toEqual([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: "Title", path: "/blog/a-slug" },
    ]);
  });
});
