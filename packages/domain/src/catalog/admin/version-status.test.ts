import { describe, expect, it } from "vitest";
import type { ProductTerms } from "./product-draft";
import {
  PRODUCT_STATUS_ACTIONS,
  decideProductStatus,
  publishBlockers,
  type PublishFacts,
} from "./product-status";
import { PRODUCT_STATUSES } from "./sellable";
import { planVersionChange } from "./version-change";

const TERMS: ProductTerms = {
  priceMinor: 69_900,
  durationMonths: 3,
  bonusMonths: 1,
  benefits: [
    { ar: "المسبح", en: "Pool" },
    { ar: "الساونا", en: "Sauna" },
  ],
};

describe("planVersionChange", () => {
  it("لا نسخة سارية ⇒ نسخة جديدة", () => {
    expect(planVersionChange(null, TERMS)).toBe("new_version");
  });

  it("لا فرق ⇒ لا كتابة", () => {
    expect(planVersionChange(TERMS, { ...TERMS, benefits: [...TERMS.benefits] })).toBe("none");
  });

  it.each([
    ["السعر", { priceMinor: 70_000 }],
    ["المدة", { durationMonths: 4 }],
    ["الأشهر المجانية", { bonusMonths: 0 }],
    ["المدة إلى لا مدة", { durationMonths: null }],
  ])("تغيّر %s ⇒ نسخة جديدة دائمًا", (_name, change) => {
    expect(planVersionChange(TERMS, { ...TERMS, ...change })).toBe("new_version");
  });

  it("المزايا وحدها: نص، أو ترتيب، أو عدد", () => {
    const [first, second] = TERMS.benefits;
    if (first === undefined || second === undefined) {
      throw new Error("fixture");
    }
    expect(planVersionChange(TERMS, { ...TERMS, benefits: [second, first] })).toBe("benefits_only");
    expect(planVersionChange(TERMS, { ...TERMS, benefits: [first] })).toBe("benefits_only");
    expect(
      planVersionChange(TERMS, { ...TERMS, benefits: [first, { ...second, en: "Dry sauna" }] }),
    ).toBe("benefits_only");
  });

  it("سعر ومزايا معًا ⇒ نسخة جديدة", () => {
    expect(planVersionChange(TERMS, { ...TERMS, priceMinor: 1, benefits: [] })).toBe("new_version");
  });
});

describe("decideProductStatus", () => {
  it("الجدول كاملًا: كل حالة مع كل إجراء", () => {
    const table = PRODUCT_STATUSES.flatMap((status) =>
      PRODUCT_STATUS_ACTIONS.map((action) => {
        const decision = decideProductStatus(status, action);
        const outcome = decision.ok
          ? `${decision.value.to}${decision.value.replay ? " (replay)" : ""}`
          : decision.error.reason;
        return `${status} + ${action} = ${outcome}`;
      }),
    );
    expect(table).toEqual([
      "draft + publish = active",
      "draft + unpublish = draft (replay)",
      "draft + archive = archived",
      "active + publish = active (replay)",
      "active + unpublish = draft",
      "active + archive = archived",
      "archived + publish = active",
      "archived + unpublish = catalog.status_not_allowed",
      "archived + archive = archived (replay)",
    ]);
  });
});

describe("publishBlockers", () => {
  const FACTS: PublishFacts = {
    kind: "membership",
    name: { ar: "3 أشهر", en: "3 months" },
    summary: { ar: "وصف", en: "Summary" },
    currentVersion: { durationMonths: 3 },
    linkedPlans: 0,
  };

  it("باقة مكتملة تُنشر بلا مانع ولا تنبيه", () => {
    expect(publishBlockers(FACTS)).toEqual({ blockers: [], warnings: [] });
  });

  it("بلا نسخة سارية", () => {
    expect(publishBlockers({ ...FACTS, currentVersion: null }).blockers).toEqual([
      "no_current_version",
    ]);
  });

  it("اشتراك بلا مدة", () => {
    expect(
      publishBlockers({ ...FACTS, currentVersion: { durationMonths: null } }).blockers,
    ).toEqual(["membership_without_duration"]);
  });

  it.each(["name", "summary"] as const)("نص %s ناقص بإحدى اللغتين", (key) => {
    const facts = { ...FACTS, [key]: { ar: "نص", en: "  " } };
    expect(publishBlockers(facts).blockers).toEqual(["texts_incomplete"]);
  });

  it("إضافة بلا باقة مرتبطة: تنبيه لا مانع؛ ومعها رابط: لا تنبيه", () => {
    const addon: PublishFacts = {
      ...FACTS,
      kind: "addon",
      currentVersion: { durationMonths: null },
    };
    expect(publishBlockers(addon)).toEqual({ blockers: [], warnings: ["addon_unlinked"] });
    expect(publishBlockers({ ...addon, linkedPlans: 1 })).toEqual({ blockers: [], warnings: [] });
  });

  it("كل الموانع معًا بترتيب ثابت", () => {
    const facts = { ...FACTS, currentVersion: null, name: { ar: "", en: "" } };
    expect(publishBlockers(facts).blockers).toEqual(["no_current_version", "texts_incomplete"]);
  });
});
