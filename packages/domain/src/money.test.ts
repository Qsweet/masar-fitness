import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { addMoney, money, moneyEquals, subtractMoney, type Money } from "./money";

describe("money", () => {
  it("يحفظ المبلغ بالهللة كعدد صحيح", () => {
    expect(money(25758)).toEqual({ amountMinor: 25758, currency: "SAR" });
    expect(money(25758, "SAR").currency).toBe("SAR");
  });

  it("يرفض عملة غير مدعومة (قيمة قادمة من القاعدة أو المزوّد)", () => {
    for (const currency of ["USD", "sar", "", "SAR "]) {
      expect(() => money(100, currency)).toThrow(/unsupported_currency/);
    }
  });

  it("الصفر السالب يُوحَّد إلى صفر", () => {
    expect(Object.is(money(-0).amountMinor, 0)).toBe(true);
    expect(Object.is(subtractMoney(money(5), money(5)).amountMinor, 0)).toBe(true);
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
    // لا يمكن بناؤها عبر money()؛ نحاكي قيمة فاسدة تسللت من خارج الحزمة
    const foreign = { amountMinor: 100, currency: "USD" } as unknown as Money;
    expect(() => addMoney(money(100), foreign)).toThrow(/currency_mismatch/);
    expect(moneyEquals(money(100), foreign)).toBe(false);
  });

  it("القيمة غير قابلة للتعديل", () => {
    const price = money(100);
    expect(Object.isFrozen(price)).toBe(true);
  });
});
