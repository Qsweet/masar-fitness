import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { addMoney, money, moneyEquals, subtractMoney, type Money } from "./money";

describe("money", () => {
  it("يحفظ المبلغ بالهللة كعدد صحيح", () => {
    expect(money(25758)).toEqual({ amountMinor: 25758, currency: "SAR" });
  });

  it("يرفض الكسور والقيم غير الآمنة", () => {
    for (const bad of [10.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => money(bad)).toThrow(DomainError);
    }
  });

  it("يجمع ويطرح بلا أخطاء الفاصلة العائمة", () => {
    // 0.1 + 0.2 !== 0.3 بالأعداد العشرية؛ بالهللة النتيجة دقيقة
    expect(addMoney(money(10), money(20))).toEqual(money(30));
    expect(subtractMoney(money(30), money(20))).toEqual(money(10));
  });

  it("يسمح بناتج سالب (يلزم لحساب فرق الاسترداد)", () => {
    expect(subtractMoney(money(100), money(250)).amountMinor).toBe(-150);
  });

  it("يرفض تجاوز الحد الآمن عند الجمع", () => {
    expect(() => addMoney(money(Number.MAX_SAFE_INTEGER), money(1))).toThrow(DomainError);
  });

  it("يرفض خلط العملات", () => {
    const foreign = { amountMinor: 100, currency: "USD" } as unknown as Money;
    expect(() => addMoney(money(100), foreign)).toThrow(/currency_mismatch/);
    expect(moneyEquals(money(100), foreign)).toBe(false);
  });

  it("القيمة غير قابلة للتعديل", () => {
    const price = money(100);
    expect(Object.isFrozen(price)).toBe(true);
  });
});
