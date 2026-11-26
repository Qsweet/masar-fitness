import { describe, expect, it } from "vitest";
import { validateSalesSettings, type SalesSettingsContext } from "./sales-settings";

const UNSET: SalesSettingsContext = {
  current: { orderPaymentWindowMinutes: null, membershipStartRule: null },
  minimumWindowMinutes: null,
};
const SET: SalesSettingsContext = {
  current: { orderPaymentWindowMinutes: 30, membershipStartRule: "on_payment" },
  minimumWindowMinutes: null,
};

function reasons(result: { ok: boolean; error?: readonly { field: string; reason: string }[] }) {
  return Object.fromEntries((result.error ?? []).map((issue) => [issue.field, issue.reason]));
}

describe("validateSalesSettings", () => {
  it("القيمتان معًا", () => {
    expect(
      validateSalesSettings({ windowMinutes: "١٤٤٠", startRule: "on_first_visit" }, UNSET),
    ).toEqual({
      ok: true,
      value: { orderPaymentWindowMinutes: 1440, membershipStartRule: "on_first_visit" },
    });
  });

  it("بلا افتراضي: الفارغ يبقى غير محسوم ما دام غير محسوم", () => {
    expect(validateSalesSettings({ windowMinutes: "", startRule: "" }, UNSET)).toEqual({
      ok: true,
      value: { orderPaymentWindowMinutes: null, membershipStartRule: null },
    });
    expect(validateSalesSettings({ windowMinutes: "60", startRule: "" }, UNSET)).toEqual({
      ok: true,
      value: { orderPaymentWindowMinutes: 60, membershipStartRule: null },
    });
  });

  it("ما حُسم لا يعود فارغًا", () => {
    expect(reasons(validateSalesSettings({ windowMinutes: " ", startRule: "" }, SET))).toEqual({
      windowMinutes: "sales_settings.cannot_unset",
      startRule: "sales_settings.cannot_unset",
    });
  });

  it.each(["0", "-5", "1.5", "abc", "43201", "9999999999"])(
    "المهلة «%s» مرفوضة",
    (windowMinutes) => {
      expect(
        reasons(validateSalesSettings({ windowMinutes, startRule: "on_payment" }, SET)),
      ).toEqual({
        windowMinutes: "sales_settings.window_invalid",
      });
    },
  );

  it("حدّا المهلة: دقيقة واحدة وثلاثون يومًا", () => {
    for (const windowMinutes of ["1", "43200"]) {
      expect(validateSalesSettings({ windowMinutes, startRule: "on_payment" }, SET).ok).toBe(true);
    }
  });

  it("مع مزوّد دفع: المهلة لا تقل عن أدناه", () => {
    const context = { ...SET, minimumWindowMinutes: 15 };
    const at = (windowMinutes: string) =>
      validateSalesSettings({ windowMinutes, startRule: "on_payment" }, context);
    expect(reasons(at("14"))).toEqual({
      windowMinutes: "sales_settings.window_below_provider_minimum",
    });
    expect(at("15").ok).toBe(true);
  });

  it("قاعدة بدء مجهولة مرفوضة", () => {
    expect(
      reasons(validateSalesSettings({ windowMinutes: "30", startRule: "later" }, SET)),
    ).toEqual({ startRule: "sales_settings.start_rule_invalid" });
  });
});
