import { describe, expect, it } from "vitest";
import { contentDigest, diffContent, snapshotEntries } from "./diff";
import { buildSnapshot } from "./snapshot";
import { testRegistry } from "./test-registry";

const registry = testRegistry();
const value = (text: string) => ({ value: text, baseHash: "h" });
const hash = (text: string) => `#${String(text.length)}:${text}`;

describe("contentDigest", () => {
  it("ثابتة مهما كان ترتيب الكتابة، وتتغير بالقيمة", () => {
    const a = new Map([
      ["hero.title", { en: value("B"), ar: value("ب") }],
      ["goals.line", { ar: value("{count} أ") }],
    ]);
    const b = new Map([
      ["goals.line", { ar: value("{count} أ") }],
      ["hero.title", { ar: value("ب"), en: value("B") }],
    ]);
    expect(contentDigest(a, hash)).toBe(contentDigest(b, hash));
    expect(contentDigest(new Map([["hero.title", { ar: value("ج") }]]), hash)).not.toBe(
      contentDigest(a, hash),
    );
  });
});

describe("diffContent", () => {
  it("إضافة وتعديل وإزالة تجاوز، بالقيمة المعروضة قبل وبعد", () => {
    const published = new Map([
      ["hero.title", { ar: value("قديم") }],
      ["meta.homeTitle", { en: value("Old gym title") }],
    ]);
    const draft = new Map([
      ["hero.title", { ar: value("جديد"), en: value("New") }],
      ["goals.line", { ar: value("صالة بأكثر من {count} جهازًا.") }],
    ]);
    expect(diffContent(published, draft, registry)).toEqual([
      {
        path: "hero.title",
        namespace: "hero",
        locale: "ar",
        kind: "changed",
        before: "قديم",
        after: "جديد",
      },
      {
        path: "hero.title",
        namespace: "hero",
        locale: "en",
        kind: "added",
        before: "The strongest you",
        after: "New",
      },
      {
        path: "meta.homeTitle",
        namespace: "meta",
        locale: "en",
        kind: "removed",
        before: "Old gym title",
        after: "A men's gym in Buraidah",
      },
    ]);
  });

  it("لا تغيير ⇒ فرق فارغ", () => {
    const same = new Map([["hero.title", { ar: value("قديم") }]]);
    expect(diffContent(same, same, registry)).toEqual([]);
  });
});

describe("snapshotEntries", () => {
  it("كل مسار ولغة صف", () => {
    const snapshot = buildSnapshot(new Map([["hero.title", { en: value("B"), ar: value("ب") }]]));
    expect(snapshotEntries(snapshot)).toEqual([
      { path: "hero.title", locale: "ar", value: value("ب") },
      { path: "hero.title", locale: "en", value: value("B") },
    ]);
  });
});
