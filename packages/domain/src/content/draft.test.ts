import { describe, expect, it } from "vitest";
import { draftOverrides, pathOfKey, textKey } from "./draft";
import { testRegistry } from "./test-registry";

const registry = testRegistry();
const value = (text: string) => ({ value: text, baseHash: "h" });

describe("تجاوزات المسودة", () => {
  it("المفتاح بالبادئة والمسار يُستخرج منه", () => {
    expect(textKey("hero.title")).toBe("text:hero.title");
    expect(pathOfKey("text:hero.title")).toBe("hero.title");
    expect(pathOfKey("setting:club.contact")).toBeNull();
  });

  it("صف يساوي الافتراضي الحالي لا يدخل التجاوزات ولا البصمة", () => {
    const parsed = draftOverrides(
      [{ key: "text:hero.title", locale: "ar", value: value("أقوى نسخة منك") }],
      registry,
    );
    expect(parsed).toEqual({ texts: new Map(), dropped: [] });
  });

  it("العودة إلى الافتراضي لا تجاوز، والمعطّل يُعدّ بمفتاحه ولغته", () => {
    const parsed = draftOverrides(
      [
        { key: "text:hero.title", locale: "ar", value: value("عنوان") },
        { key: "text:hero.title", locale: "en", value: null },
        { key: "text:hero.pause", locale: "ar", value: value("قف") },
        { key: "text:goals.line", locale: "en", value: value("no count") },
        { key: "setting:x", locale: "ar", value: value("x") },
      ],
      registry,
    );
    expect(parsed.texts).toEqual(new Map([["hero.title", { ar: value("عنوان") }]]));
    expect(parsed.dropped).toEqual(["setting:x [ar]", "hero.pause [ar]", "goals.line [en]"]);
  });
});
