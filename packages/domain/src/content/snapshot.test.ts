import { describe, expect, it } from "vitest";
import { applyTextOverrides } from "./apply";
import { buildSnapshot, parseSnapshot } from "./snapshot";
import { TEST_DICTIONARIES, testRegistry } from "./test-registry";

const registry = testRegistry();
const base = (value: string) => ({ value, baseHash: "h" });

describe("parseSnapshot", () => {
  it("يقبل التجاوز الصحيح ويُسقط المجهول والممنوع والعنصر المخالف للافتراضي الحالي", () => {
    const parsed = parseSnapshot(
      {
        v: 1,
        texts: {
          "hero.title": { ar: base("عنوان جديد"), en: base("New title"), fr: base("x") },
          "hero.pause": { ar: base("قف") },
          "hero.removed": { ar: base("قديم") },
          "goals.line": { ar: base("بلا عدد"), en: base("{count} machines") },
          "Bad Path": { ar: base("x") },
          "meta.homeTitle": { ar: { value: 5, baseHash: "h" } },
        },
        indexable: true,
      },
      registry,
    );
    expect(parsed?.texts).toEqual(
      new Map([
        ["hero.title", { ar: base("عنوان جديد"), en: base("New title") }],
        ["goals.line", { en: base("{count} machines") }],
      ]),
    );
    expect(parsed?.dropped).toEqual([
      "indexable [*]",
      "hero.title [fr]",
      "hero.pause [ar]",
      "hero.removed [ar]",
      "goals.line [ar]",
      "Bad Path [*]",
      "meta.homeTitle [ar]",
    ]);
  });

  it("إصدار مخطط مجهول أو شكل آخر ⇒ null", () => {
    expect(parseSnapshot({ v: 2, texts: {} }, registry)).toBeNull();
    expect(parseSnapshot([], registry)).toBeNull();
    expect(parseSnapshot({ v: 1 }, registry)).toBeNull();
  });

  it("الشكل القانوني مرتب ويُقرأ كما كُتب", () => {
    const texts = new Map([
      ["hero.title", { en: base("B"), ar: base("ب") }],
      ["goals.line", { ar: base("{count} أ") }],
    ]);
    const snapshot = buildSnapshot(texts);
    expect(JSON.stringify(snapshot)).toBe(
      '{"v":1,"texts":{"goals.line":{"ar":{"value":"{count} أ","baseHash":"h"}},"hero.title":{"ar":{"value":"ب","baseHash":"h"},"en":{"value":"B","baseHash":"h"}}}}',
    );
    expect(parseSnapshot(snapshot, registry)?.texts).toEqual(
      new Map([
        ["goals.line", { ar: base("{count} أ") }],
        ["hero.title", { ar: base("ب"), en: base("B") }],
      ]),
    );
  });
});

describe("applyTextOverrides", () => {
  it("يغيّر المسارات المعطاة وحدها ويبقي الفروع الأخرى المرجع نفسه", () => {
    const tree = TEST_DICTIONARIES.ar;
    const result = applyTextOverrides(
      tree,
      new Map([
        ["hero.title", { ar: base("جديد"), en: base("New") }],
        ["about.paragraphs.0", { ar: base("فقرة") }],
      ]),
      "ar",
    );
    expect(result.hero.title).toBe("جديد");
    expect(result.hero.pause).toBe(tree.hero.pause);
    expect(result.about.paragraphs).toEqual(["فقرة"]);
    expect(result.goals).toBe(tree.goals);
    expect(result.meta).toBe(tree.meta);
    expect(tree.hero.title).toBe("أقوى نسخة منك");
  });

  it("لا يضيف مفتاحًا ولا عنصرًا، ولا يمس لغة أخرى", () => {
    const tree = TEST_DICTIONARIES.en;
    const result = applyTextOverrides(
      tree,
      new Map([
        ["hero.extra", { en: base("x") }],
        ["about.paragraphs.3", { en: base("x") }],
        ["hero.title", { ar: base("عربي") }],
      ]),
      "en",
    );
    expect(result).toEqual(tree);
  });
});
