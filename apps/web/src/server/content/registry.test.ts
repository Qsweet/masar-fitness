import { placeholderNames, TEXT_LIMITS, textLength } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { LOCK_REASONS } from "@/content/site/editable";
import { textRegistry } from "./registry";

/** ADMIN_A3_CONTENT §3.2 و§11 (WP1، قائمة القبول 4): السجل الحقيقي من القاموسين وقائمة السماح. */
const FORBIDDEN_NAMESPACES = [
  "currency",
  "months",
  "days",
  "nav",
  "staging",
  "plans",
  "plan",
  "payment",
  "onlinePayment",
  "checkout",
  "cart",
  "steps",
  "tabs",
  "daily",
  "dailyNote",
  "location",
  "quickBar",
  "notFound",
  "error",
  "blog",
];
const MONEY_PLACEHOLDERS = new Set(["amount", "unit", "price", "total", "monthly"]);
const registry = textRegistry();
const editable = [...registry.editable.values()];

describe("سجل نصوص الموقع", () => {
  it("كل مسموح ورقة نصية بافتراضيين غير فارغين، وعناصره من افتراضيه", () => {
    expect(editable.length).toBeGreaterThan(140);
    for (const entry of editable) {
      expect(entry.defaults.ar, entry.path).not.toBe("");
      expect(entry.defaults.en, entry.path).not.toBe("");
      expect(entry.placeholders.ar).toEqual(placeholderNames(entry.defaults.ar));
      expect(entry.placeholders.en).toEqual(placeholderNames(entry.defaults.en));
    }
  });

  it("لا مسار مسموح من المساحات الممنوعة كليًا", () => {
    const leaked = editable.filter((entry) => FORBIDDEN_NAMESPACES.includes(entry.namespace));
    expect(leaked.map((entry) => entry.path)).toEqual([]);
  });

  it("لا سعر ولا مبلغ ولا وحدة مال في عنصر نائب لنص مسموح", () => {
    const money = editable.filter((entry) =>
      [...entry.placeholders.ar, ...entry.placeholders.en].some((name) =>
        MONEY_PLACEHOLDERS.has(name),
      ),
    );
    expect(money.map((entry) => entry.path)).toEqual([]);
  });

  it("الافتراضي نفسه داخل حد نوعه، فلا يُرفض حفظه كما هو", () => {
    for (const entry of editable) {
      const limit = TEXT_LIMITS[entry.kind];
      expect(textLength(entry.defaults.ar), entry.path).toBeLessThanOrEqual(limit);
      expect(textLength(entry.defaults.en), entry.path).toBeLessThanOrEqual(limit);
    }
  });

  it("الممنوع داخل المسموح كما في الجدول", () => {
    const locked = new Map(registry.locked.map((item) => [item.path, item.reason]));
    expect(locked.get("hero.pause")).toBe("accessibility");
    expect(locked.get("reviews.stars")).toBe("accessibility");
    expect(locked.get("services.from")).toBe("format");
    expect(locked.get("friends.perPerson")).toBe("offerTerms");
    expect(locked.get("cta.note")).toBe("terms");
    expect(locked.get("contact.privacy")).toBe("claim");
    expect(locked.get("club.logoAlt")).toBe("brand");
    expect(locked.get("tools.costPerVisit.approximate")).toBe("claim");
    expect(registry.editable.get("club.name")?.permission).toBe("content.facts");
    expect(registry.editable.get("footer.tagline")?.permission).toBe("content.write");
    expect(registry.editable.get("memberships.compareTitle")).toBeUndefined();
  });

  it("كل سبب منع له رمز معروف يترجمه القاموس", () => {
    const known = new Set<string>([...LOCK_REASONS, "notListed", "emptyDefault"]);
    expect(registry.locked.filter((item) => !known.has(item.reason))).toEqual([]);
  });
});
