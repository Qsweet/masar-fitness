import { describe, expect, it } from "vitest";
import { PRODUCT_KINDS, PRODUCT_STATUSES, isSellable, type SellableFacts } from "./sellable";

const version = { durationMonths: 3 };

describe("isSellable", () => {
  it("اشتراك فعّال بنسخة سارية ومدة يُباع", () => {
    expect(isSellable({ status: "active", kind: "membership", currentVersion: version })).toBe(
      true,
    );
  });

  it.each(["draft", "archived"] as const)("الحالة %s لا تُباع مهما كان النوع", (status) => {
    for (const kind of PRODUCT_KINDS) {
      expect(isSellable({ status, kind, currentVersion: version })).toBe(false);
    }
  });

  it("بلا نسخة سارية لا يُباع", () => {
    for (const kind of PRODUCT_KINDS) {
      expect(isSellable({ status: "active", kind, currentVersion: null })).toBe(false);
    }
  });

  it("اشتراك بلا مدة لا يُباع، والإضافة والبرنامج الرقمي بلا مدة يُباعان", () => {
    const noDuration = { durationMonths: null };
    const facts = (kind: SellableFacts["kind"]): SellableFacts => ({
      status: "active",
      kind,
      currentVersion: noDuration,
    });
    expect(isSellable(facts("membership"))).toBe(false);
    expect(isSellable(facts("addon"))).toBe(true);
    expect(isSellable(facts("digital_program"))).toBe(true);
  });

  it("الخدمة بتقييم لا تُشترى مباشرة أبدًا", () => {
    expect(
      isSellable({ status: "active", kind: "assessed_service", currentVersion: version }),
    ).toBe(false);
  });

  it("الجدول كاملًا: يُباع فقط الفعّال بنسخة ونوع يُشترى", () => {
    const sellable = PRODUCT_STATUSES.flatMap((status) =>
      PRODUCT_KINDS.filter((kind) => isSellable({ status, kind, currentVersion: version })).map(
        (kind) => `${status}:${kind}`,
      ),
    );
    expect(sellable).toEqual(["active:membership", "active:digital_program", "active:addon"]);
  });
});
