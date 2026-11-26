import { describe, expect, it } from "vitest";
import { getAdminDictionary } from "@/i18n/admin";
import { attemptMethodLabel, orderNoticeCode, paymentLabel, providerLabel } from "./order-view";

const { statuses } = getAdminDictionary().sales;
const RAW_ID = /[a-z]+_[a-z]+|^[a-z_]+$/;

describe("اسم طريقة الدفع: لا معرّف خامًا في الواجهة", () => {
  it("اليدوي بطريقته، والمزوّدون بأسمائهم، وغير المدفوع بنصه", () => {
    expect(paymentLabel(null, null, statuses)).toBe("لم يُدفع");
    expect(paymentLabel("manual", "bank_transfer", statuses)).toBe("يدوي: حوالة بنكية");
    expect(paymentLabel("manual", "paid_at_club", statuses)).toBe("يدوي: مدفوع في النادي");
    expect(paymentLabel("manual", null, statuses)).toBe("دفع يدوي");
    expect(paymentLabel("moyasar", null, statuses)).toBe("ميسّر (Moyasar)");
    expect(paymentLabel("fake", null, statuses)).toBe("بوابة الاختبار");
  });

  it.each(["test_pay", "tabby", "some_new_provider", "constructor", "__proto__", ""])(
    "مزوّد بلا اسم «%s» يأخذ الاسم العام لا رمزه",
    (provider) => {
      expect(providerLabel(provider, statuses.payment)).toBe("بوابة دفع إلكتروني");
      expect(paymentLabel(provider, null, statuses)).toBe("بوابة دفع إلكتروني");
      expect(paymentLabel(provider, "bank_transfer", statuses)).toBe("بوابة دفع إلكتروني");
    },
  );

  it("طريقة يدوية مجهولة لا تُعرض برمزها", () => {
    expect(paymentLabel("manual", "wire_x", statuses)).toBe("دفع يدوي");
  });

  it("وسيلة المحاولة: المعروفة باسمها، والمجهولة بالاسم العام، وغير المعروفة بعد null", () => {
    expect(attemptMethodLabel("mada", statuses.payment)).toBe("مدى");
    expect(attemptMethodLabel("fake_card", statuses.payment)).toBe("بطاقة اختبار");
    expect(attemptMethodLabel("crypto_x", statuses.payment)).toBe("وسيلة أخرى");
    expect(attemptMethodLabel(null, statuses.payment)).toBeNull();
  });

  it("لا اسم في القاموس يشبه معرّفًا خامًا", () => {
    const labels = [
      ...Object.values(statuses.payment.providers),
      ...Object.values(statuses.payment.methods),
      statuses.payment.unknownProvider,
      statuses.payment.unknownMethod,
    ];
    for (const label of labels) {
      expect(label).not.toMatch(RAW_ID);
    }
  });
});

function detail(status: string, provider: string | null) {
  return {
    order: { status },
    payment: provider === null ? null : { provider },
  } as Parameters<typeof orderNoticeCode>[1];
}

describe("تنبيه النجاح يصدّقه حال الطلب", () => {
  it("«سُجّل الدفع» على طلب مدفوع يدويًا فقط", () => {
    const code = "manual_payment_recorded";
    expect(orderNoticeCode(code, detail("fulfilled", "manual"))).toBe(code);
    expect(orderNoticeCode(code, detail("pending_payment", null))).toBeUndefined();
    expect(orderNoticeCode(code, detail("fulfilled", "moyasar"))).toBeUndefined();
    expect(orderNoticeCode(code, detail("cancelled", null))).toBeUndefined();
  });

  it("«أُلغي الطلب» على طلب ملغى فقط", () => {
    const code = "order_cancelled";
    expect(orderNoticeCode(code, detail("cancelled", null))).toBe(code);
    expect(orderNoticeCode(code, detail("pending_payment", null))).toBeUndefined();
    expect(orderNoticeCode(code, detail("fulfilled", "manual"))).toBeUndefined();
  });

  it("رمز لا يخص الطلب، أو مكرر في الرابط، أو خاصية موروثة: لا تنبيه", () => {
    const paid = detail("fulfilled", "manual");
    for (const done of ["staff_created", "password_changed", "", "constructor", undefined]) {
      expect(orderNoticeCode(done, paid)).toBeUndefined();
    }
    expect(orderNoticeCode(["manual_payment_recorded", "x"], paid)).toBeUndefined();
  });
});
