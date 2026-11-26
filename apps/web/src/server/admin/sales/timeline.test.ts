import type { AuditRow } from "@masar/db";
import { describe, expect, it } from "vitest";
import { getAdminDictionary } from "@/i18n/admin";
import { timelineEvents } from "./timeline";

const dictionary = getAdminDictionary();
const STAFF_ID = "018f4e2a-0000-7000-8000-000000000001";
const names = new Map([[STAFF_ID, "سارة الحربي"]]);

function row(overrides: Partial<AuditRow>): AuditRow {
  return {
    id: "a-1",
    entityType: "order",
    entityId: "018f4e2a-aaaa-7000-8000-000000000009",
    action: "order_created",
    fromState: null,
    toState: "pending_payment",
    actor: "customer",
    data: {},
    createdAt: new Date("2026-06-15T09:00:00Z"),
    ...overrides,
  };
}

describe("الخط الزمني للطلب", () => {
  it("كل حدث بعنوانه العربي وفاعله: العميل والنظام والمزوّد والموظف باسمه", () => {
    const events = timelineEvents(
      [
        row({ id: "1" }),
        row({ id: "2", action: "order_fulfilled", actor: "system" }),
        row({ id: "3", action: "payment_verified", actor: "provider" }),
        row({ id: "4", action: "order_cancelled", actor: `staff:${STAFF_ID}` }),
        row({ id: "5", action: "order_cancelled", actor: "staff:018f4e2a-ffff" }),
      ],
      names,
      dictionary,
    );
    expect(events.map((event) => [event.title, event.actor])).toEqual([
      ["أُنشئ الطلب", "عميل"],
      ["اكتمل الطلب", "النظام"],
      ["سُجّل الدفع", "مزوّد الدفع"],
      ["أُلغي الطلب", "سارة الحربي"],
      ["أُلغي الطلب", "موظف غير معروف"],
    ]);
  });

  it("من التفاصيل ما يهم الموظف فقط، مترجمًا؛ والمعرّفات والمبالغ الخام لا تُعرض", () => {
    const [cancelled, manual, verified, unknown, fake] = timelineEvents(
      [
        row({
          action: "order_cancelled",
          fromState: "pending_payment",
          toState: "cancelled",
          data: { reference: "MSR-0000001", reason: "customer_request" },
        }),
        row({
          entityType: "manual_payment",
          action: "manual_payment_recorded",
          data: {
            orderId: "018f4e2a",
            method: "paid_at_club",
            externalReference: "RCPT-7",
            receivedOn: "2026-06-15",
            amountMinor: 149_900,
            currency: "SAR",
          },
        }),
        row({
          action: "payment_verified",
          data: { provider: "manual", providerPaymentId: "018f", amountMinor: 1, currency: "SAR" },
        }),
        row({ action: "payment_verified", data: { provider: "test_pay" } }),
        row({ action: "payment_attempt_created", data: { provider: "fake" } }),
      ],
      names,
      dictionary,
    );
    expect(cancelled?.lines).toEqual(["السبب: طلب العميل"]);
    expect(manual?.lines).toEqual([
      "الطريقة: مدفوع في النادي",
      "المرجع الخارجي: RCPT-7",
      "تاريخ الاستلام: 15 يونيو 2026",
    ]);
    expect(verified?.lines).toEqual(["المزوّد: دفع يدوي"]);
    // مزوّد بلا اسم في القاموس يأخذ الاسم العام، لا رمزه الخام
    expect(unknown?.lines).toEqual(["المزوّد: بوابة دفع إلكتروني"]);
    expect(fake?.lines).toEqual(["المزوّد: بوابة الاختبار"]);
  });

  it("القيم الفارغة لا تصير أسطرًا", () => {
    const [created] = timelineEvents(
      [
        row({
          entityType: "membership",
          action: "membership_created",
          data: { orderId: "x", startsOn: null, endsOn: null, reason: null },
        }),
      ],
      names,
      dictionary,
    );
    expect(created).toMatchObject({ title: "أُنشئ الاشتراك", lines: [] });
  });
});
