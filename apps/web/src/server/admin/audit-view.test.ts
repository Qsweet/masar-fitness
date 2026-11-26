import { UNKNOWN_STAFF_ID, type AuditRow } from "@masar/db";
import { describe, expect, it } from "vitest";
import { getAdminDictionary } from "@/i18n/admin";
import { auditRowView } from "./audit-view";

const dictionary = getAdminDictionary();
const OWNER = "018f4e2a-0000-7000-8000-000000000001";
const SALES = "018f4e2a-0000-7000-8000-000000000002";
const names = new Map([
  [OWNER, "خالد"],
  [SALES, "سارة"],
]);

function row(overrides: Partial<AuditRow>): AuditRow {
  return {
    id: "018f4e2a-0000-7000-8000-00000000000a",
    entityType: "staff_user",
    entityId: SALES,
    action: "role_changed",
    fromState: null,
    toState: null,
    actor: `staff:${OWNER}`,
    data: {},
    createdAt: new Date("2026-11-26T09:00:00Z"),
    ...overrides,
  };
}

describe("صف سجل التدقيق", () => {
  it("تغيير الدور: الفاعل والموظف باسميهما، والدوران مترجمان", () => {
    const view = auditRowView(row({ fromState: "sales", toState: "manager" }), names, dictionary);
    expect(view).toMatchObject({
      actor: "خالد",
      action: "غُيّر الدور",
      subject: "سارة",
      details: ["مبيعات ← مدير"],
    });
  });

  it("دخول فاشل بلا حساب: فاعل النظام، وبلا اسم، والسبب مترجم", () => {
    const view = auditRowView(
      row({
        action: "login_failed",
        actor: "system",
        entityId: UNKNOWN_STAFF_ID,
        data: { ip: "10.1.2.3", reason: "unknown_account" },
      }),
      names,
      dictionary,
    );
    expect(view.actor).toBe("النظام");
    expect(view.subject).toBe("حساب غير موجود");
    expect(view.details).toEqual(["العنوان: 10.1.2.3", "السبب: لا حساب بهذا البريد"]);
  });

  it("حدث بيع: نوع الكيان ومعرّف مختصر، والحدث وحالاته بنصوصها", () => {
    const view = auditRowView(
      row({
        entityType: "order",
        entityId: "018f4e2a-aaaa-7000-8000-000000000009",
        action: "payment_verified",
        actor: "provider",
        fromState: "pending_payment",
        toState: "paid",
      }),
      names,
      dictionary,
    );
    expect(view).toMatchObject({
      actor: "مزوّد الدفع",
      action: "سُجّل الدفع",
      subject: "طلب 018f4e2a",
      details: ["بانتظار الدفع ← مدفوع"],
    });
  });

  it("الرمز نفسه بنص كيانه: «expired» للطلب غيره للاشتراك ولمحاولة الدفع", () => {
    const expired = (entityType: string) =>
      auditRowView(row({ entityType, action: "x", toState: "expired" }), names, dictionary).details;
    expect(expired("order")).toEqual(["انتهت مهلته"]);
    expect(expired("membership")).toEqual(["منتهٍ"]);
    expect(expired("payment_attempt")).toEqual(["انتهت جلستها"]);
  });

  it("حدث وحالة بلا ترجمة يُعرضان برمزيهما", () => {
    const view = auditRowView(
      row({ entityType: "refund", action: "refund_probe", fromState: "a", toState: "b" }),
      names,
      dictionary,
    );
    expect(view).toMatchObject({ action: "refund_probe", details: ["a ← b"] });
  });

  it("أحداث اللوحة على الطلب: الإلغاء بسببه، والدفع اليدوي بطريقته، وكشف الجوال بمصدره", () => {
    const cancelled = auditRowView(
      row({
        entityType: "order",
        action: "order_cancelled",
        fromState: "pending_payment",
        toState: "cancelled",
        data: { reason: "duplicate_order" },
      }),
      names,
      dictionary,
    );
    expect(cancelled.action).toBe("أُلغي الطلب");
    expect(cancelled.details).toEqual(["بانتظار الدفع ← ملغى", "السبب: طلب مكرر"]);
    const manual = auditRowView(
      row({
        entityType: "manual_payment",
        action: "manual_payment_recorded",
        data: { method: "bank_transfer", externalReference: "TRF-1" },
      }),
      names,
      dictionary,
    );
    expect(manual.subject).toMatch(/^دفعة يدوية /);
    expect(manual.details).toEqual(["الطريقة: حوالة بنكية", "المرجع الخارجي: TRF-1"]);
    const reveal = auditRowView(
      row({ entityType: "customer", action: "phone_revealed", data: { source: "order" } }),
      names,
      dictionary,
    );
    expect(reveal).toMatchObject({ action: "كُشف جوال عميل", details: ["من: تفصيل طلب"] });
  });

  it("موظف غير معروف، وطريقة التحقق مترجمة، وعدد الرموز الباقية", () => {
    const stranger = "018f4e2a-0000-7000-8000-0000000000ff";
    const view = auditRowView(
      row({
        action: "recovery_code_used",
        actor: `staff:${stranger}`,
        entityId: stranger,
        data: { remaining: 9, method: "recovery" },
      }),
      names,
      dictionary,
    );
    expect(view.actor).toBe("موظف غير معروف");
    expect(view.subject).toBe("موظف غير معروف");
    expect(view.details).toEqual(["الرموز الباقية: 9", "الطريقة: رمز استرجاع"]);
  });

  it("إنشاء موظف: الحالة الجديدة وحدها", () => {
    const view = auditRowView(
      row({ action: "staff_created", toState: "editor" }),
      names,
      dictionary,
    );
    expect(view.details).toEqual(["محرر"]);
  });
});
