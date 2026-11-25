import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { LOCALES } from "@/i18n/locales";
import { CHECKOUT_ERROR_REASONS, displayReason, errorText } from "./error-text";

describe("نص أسباب أخطاء الشراء", () => {
  it("كل سبب معروف له نص غير فارغ باللغتين", () => {
    for (const locale of LOCALES) {
      const dictionary = getDictionary(locale);
      for (const reason of CHECKOUT_ERROR_REASONS) {
        expect(errorText(reason, dictionary).length, `${locale} ${reason}`).toBeGreaterThan(0);
      }
    }
  });

  it("القاموس لا يحمل نصًا لسبب خارج القائمة", () => {
    expect(Object.keys(getDictionary("ar").checkout.errors).sort()).toEqual(
      [...CHECKOUT_ERROR_REASONS].sort(),
    );
  });

  it("كل سياسة غير محسومة نص واحد، والسبب غير المعروف نص عام", () => {
    expect(displayReason("policy.undecided.order_payment_window")).toBe("policy.undecided");
    expect(displayReason("policy.undecided.membership_start_rule")).toBe("policy.undecided");
    expect(displayReason("pricing.totals_mismatch")).toBe("form.generic");
    expect(errorText("something.else", getDictionary("ar"))).toBe(
      getDictionary("ar").checkout.errors["form.generic"],
    );
  });

  it("أسباب وجود الكوبون لا نص لها: تُطوى قبل العرض، وإن تسرّبت فالنص العام", () => {
    for (const reason of ["coupon.unknown", "promotion.inactive", "promotion.not_started"]) {
      expect(displayReason(reason), reason).toBe("form.generic");
    }
  });
});
