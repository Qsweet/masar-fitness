import { describe, expect, it } from "vitest";
import {
  CONTENT_PATH_SHAPE,
  hasStrayBrace,
  isUnder,
  placeholderNames,
  textAt,
  textLeaves,
} from "./paths";

const TREE = { hero: { title: "أ", items: [{ name: "ب" }, { name: "ج" }] }, count: 3 };

describe("مسارات أوراق القاموس", () => {
  it("كل ورقة نصية بمسارها والفهرس رقم، وما ليس نصًا لا يُعدّ", () => {
    expect(textLeaves(TREE)).toEqual([
      { path: "hero.title", value: "أ" },
      { path: "hero.items.0.name", value: "ب" },
      { path: "hero.items.1.name", value: "ج" },
    ]);
  });

  it("textAt يقرأ الورقة النصية وحدها", () => {
    expect(textAt(TREE, "hero.items.1.name")).toBe("ج");
    expect(textAt(TREE, "hero.items")).toBeUndefined();
    expect(textAt(TREE, "hero.items.2.name")).toBeUndefined();
    expect(textAt(TREE, "count")).toBeUndefined();
    expect(textAt(TREE, "hero.constructor")).toBeUndefined();
    expect(textAt(TREE, "__proto__.x")).toBeUndefined();
  });

  it("شكل المسار: أسماء بنقاط وأرقام، بلا فراغ ولا أقواس", () => {
    expect(CONTENT_PATH_SHAPE.test("about.paragraphs.0")).toBe(true);
    expect(CONTENT_PATH_SHAPE.test("hero..title")).toBe(false);
    expect(CONTENT_PATH_SHAPE.test("Hero.title")).toBe(false);
    expect(CONTENT_PATH_SHAPE.test("hero.title[0]")).toBe(false);
  });

  it("البادئة تشمل نفسها وما تحتها لا ما يشبهها", () => {
    expect(isUnder("hero.title", "hero")).toBe(true);
    expect(isUnder("hero", "hero")).toBe(true);
    expect(isUnder("heroes.title", "hero")).toBe(false);
  });

  it("العناصر النائبة بلا تكرار، والقوس الشارد يُكشف", () => {
    expect(placeholderNames("{b} و{a} و{b}")).toEqual(["a", "b"]);
    expect(hasStrayBrace("من {amount} ريال")).toBe(false);
    expect(hasStrayBrace("من { amount}")).toBe(true);
    expect(hasStrayBrace("نهاية }")).toBe(true);
    expect(hasStrayBrace("{{amount}}")).toBe(true);
  });
});
