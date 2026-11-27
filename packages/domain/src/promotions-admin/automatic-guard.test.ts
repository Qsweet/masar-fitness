import { describe, expect, it } from "vitest";
import { basisPoints } from "../commerce/pricing/vat";
import { money } from "../money";
import { automaticZeroedProducts, type SellablePrice } from "./automatic-guard";

const PLAN: SellablePrice = {
  id: "plan",
  name: { ar: "3 أشهر", en: "3 months" },
  price: money(50_000),
};
const ADDON: SellablePrice = { id: "pt", name: { ar: "مدرب", en: "PT" }, price: money(5_000) };
const ALL = { kind: "all_products" } as const;

function fixed(amountMinor: number) {
  return { kind: "fixed_amount", amount: money(amountMinor) } as const;
}

describe("automaticZeroedProducts", () => {
  it("مبلغ ثابت يبلغ سعر منتج في النطاق أو يتجاوزه يسمّيه", () => {
    const zeroed = automaticZeroedProducts({ code: null, discount: fixed(100_000), scope: ALL }, [
      PLAN,
      ADDON,
    ]);
    expect(zeroed.map((product) => product.id)).toEqual(["plan", "pt"]);
    const exact = automaticZeroedProducts({ code: null, discount: fixed(5_000), scope: ALL }, [
      PLAN,
      ADDON,
    ]);
    expect(exact.map((product) => product.id)).toEqual(["pt"]);
  });

  it("مبلغ أقل من كل سعر، أو منتج خارج النطاق: لا شيء", () => {
    expect(
      automaticZeroedProducts({ code: null, discount: fixed(4_999), scope: ALL }, [PLAN, ADDON]),
    ).toEqual([]);
    const planOnly = { kind: "listed_products", productIds: ["plan"] } as const;
    expect(
      automaticZeroedProducts({ code: null, discount: fixed(10_000), scope: planOnly }, [
        PLAN,
        ADDON,
      ]),
    ).toEqual([]);
  });

  it("نسبة 100% تصفّر كل منتج في النطاق، و99.99% لا", () => {
    const full = { kind: "percentage", rate: basisPoints(10_000) } as const;
    const almost = { kind: "percentage", rate: basisPoints(9_999) } as const;
    expect(automaticZeroedProducts({ code: null, discount: full, scope: ALL }, [PLAN])).toEqual([
      PLAN,
    ]);
    expect(automaticZeroedProducts({ code: null, discount: almost, scope: ALL }, [PLAN])).toEqual(
      [],
    );
  });

  it("الكوبون خارج الحارس: يكتبه العميل ورفضه يظهر له", () => {
    expect(
      automaticZeroedProducts({ code: "FREE", discount: fixed(100_000), scope: ALL }, [PLAN]),
    ).toEqual([]);
  });
});
