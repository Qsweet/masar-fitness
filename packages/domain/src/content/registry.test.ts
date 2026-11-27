import { describe, expect, it } from "vitest";
import { buildTextRegistry, LOCK_EMPTY_DEFAULT, LOCK_NOT_LISTED, type TextRule } from "./registry";

const AR = {
  hero: { title: "عنوان", pause: "أوقف", note: "" },
  club: { name: "النادي", logoAlt: "شعار" },
  plans: { from: "من {amount}" },
  list: ["أ", "ب"],
};
const EN = {
  hero: { title: "Title", pause: "Pause", note: "" },
  club: { name: "Club", logoAlt: "Logo" },
  plans: { from: "From {amount}" },
  list: ["A"],
};
const RULES: readonly TextRule[] = [
  { prefix: "hero", permission: "content.write" },
  { prefix: "hero.pause", locked: "accessibility" },
  { prefix: "club", locked: "brand" },
  { prefix: "club.name", permission: "content.facts" },
  { prefix: "list", permission: "content.write" },
];
const hash = (text: string) => `h:${text}`;

describe("سجل النصوص", () => {
  const registry = buildTextRegistry({ ar: AR, en: EN }, RULES, hash);

  it("أطول بادئة تحكم: المسموح داخل الممنوع وبالعكس", () => {
    expect([...registry.editable.keys()]).toEqual(["hero.title", "club.name", "list.0"]);
    expect(registry.editable.get("club.name")?.permission).toBe("content.facts");
    const reasons = Object.fromEntries(registry.locked.map((item) => [item.path, item.reason]));
    expect(reasons).toEqual({
      "hero.pause": "accessibility",
      "hero.note": LOCK_EMPTY_DEFAULT,
      "club.logoAlt": "brand",
      "plans.from": LOCK_NOT_LISTED,
      "list.1": LOCK_EMPTY_DEFAULT,
    });
  });

  it("لكل مسموح الافتراضيان وعناصرهما النائبة وبصمتاهما ونوعه", () => {
    expect(registry.editable.get("hero.title")).toEqual({
      path: "hero.title",
      namespace: "hero",
      kind: "label",
      permission: "content.write",
      defaults: { ar: "عنوان", en: "Title" },
      placeholders: { ar: [], en: [] },
      defaultHash: { ar: "h:عنوان", en: "h:Title" },
    });
  });

  it("المساحات بترتيب القاموس", () => {
    expect(registry.namespaces).toEqual(["hero", "club", "plans", "list"]);
  });
});
