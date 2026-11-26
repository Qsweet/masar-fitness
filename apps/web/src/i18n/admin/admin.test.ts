import {
  ATTEMPT_STATUSES,
  INCIDENT_KINDS,
  MANUAL_PAYMENT_METHODS,
  MEMBERSHIP_START_RULES,
  MEMBERSHIP_STATUSES,
  ORDER_CANCEL_REASONS,
  ORDER_STATUSES,
  PERMISSIONS,
  REFUND_STATUSES,
  STAFF_ROLES,
  STAFF_STATUSES,
} from "@masar/domain";
import {
  AUDIT_ACTOR_KINDS,
  AUDIT_ENTITY_TYPES,
  ORDER_LIST_TABS,
  STAFF_AUDIT_ACTIONS,
} from "@masar/db";
import { describe, expect, it } from "vitest";
import { formatDateTime, formatDay } from "./format";
import { ADMIN_LOCALES, adminDirection, getAdminDictionary, lookup } from "./index";

describe("قاموس اللوحة", () => {
  it.each(ADMIN_LOCALES)("%s: كل رمز يكتبه الكود له نص", (locale) => {
    const dictionary = getAdminDictionary(locale);
    expect(Object.keys(dictionary.roles).sort()).toEqual([...STAFF_ROLES].sort());
    expect(Object.keys(dictionary.roleHints).sort()).toEqual([...STAFF_ROLES].sort());
    expect(Object.keys(dictionary.statuses).sort()).toEqual([...STAFF_STATUSES].sort());
    expect(Object.keys(dictionary.audit.actions).sort()).toEqual([...STAFF_AUDIT_ACTIONS].sort());
    expect(Object.keys(dictionary.audit.entities).sort()).toEqual([...AUDIT_ENTITY_TYPES].sort());
    expect(Object.keys(dictionary.audit.actors).sort()).toEqual([...AUDIT_ACTOR_KINDS].sort());
    expect(Object.keys(dictionary.overview.orderStatuses).sort()).toEqual(
      [...ORDER_STATUSES].sort(),
    );
    expect(Object.keys(dictionary.overview.activity.sentences).sort()).toEqual(
      [...STAFF_AUDIT_ACTIONS].sort(),
    );
    expect(PERMISSIONS.length).toBeGreaterThan(0);
  });

  it.each(ADMIN_LOCALES)("%s: كل حالة ورمز في المبيعات له نص", (locale) => {
    const { sales, errors, notices, audit, overview } = getAdminDictionary(locale);
    const keys = (map: object) => Object.keys(map).sort();
    expect(keys(sales.statuses.order)).toEqual([...ORDER_STATUSES].sort());
    expect(sales.statuses.order).toBe(overview.orderStatuses);
    expect(keys(sales.statuses.membership)).toEqual([...MEMBERSHIP_STATUSES].sort());
    expect(keys(sales.statuses.attempt)).toEqual([...ATTEMPT_STATUSES].sort());
    expect(keys(sales.statuses.incident)).toEqual([...INCIDENT_KINDS].sort());
    expect(keys(sales.statuses.refund)).toEqual([...REFUND_STATUSES].sort());
    expect(keys(sales.statuses.startRule)).toEqual([...MEMBERSHIP_START_RULES].sort());
    expect(keys(sales.statuses.manualMethod)).toEqual([...MANUAL_PAYMENT_METHODS].sort());
    expect(keys(sales.orders.tabs)).toEqual([...ORDER_LIST_TABS].sort());
    expect(keys(sales.orders.cancel.reasons)).toEqual([...ORDER_CANCEL_REASONS].sort());
    // كل سبب ترجعه خدمات المبيعات وقواعدها (مجموع من الكود): نقص ترجمة يظهر هنا لا أمام الموظف
    for (const reason of [
      "amount.invalid_format",
      "amount.negative",
      "amount.too_large",
      "amount.too_many_decimals",
      "customer.not_found",
      "customers.mobile_invalid",
      "customers.too_many_lookups",
      "customers.too_many_reveals",
      "manual_payment.method_invalid",
      "manual_payment.note_too_long",
      "manual_payment.received_on_invalid",
      "manual_payment.reference_invalid",
      "manual_payment.reference_used",
      "order.already_paid",
      "order.cancel_blocked_by_live_attempt",
      "order.cancel_reason_invalid",
      "order.not_cancellable",
      "order.not_found",
      "order.not_payable",
      "order.payment_window_passed",
      "order.settle_blocked_by_live_attempt",
      "orders.settle_confirmation_required",
      "orders.settle_preview_refused",
      "orders.settle_token_invalid",
      "orders.settle_too_many_attempts",
      "payment.already_used",
      "payment.amount_mismatch",
      "payment.currency_mismatch",
      "sales.invalid_request",
    ]) {
      expect(lookup(errors, reason, "")).not.toBe("");
    }
    for (const action of ["order_cancelled", "manual_payment_recorded", "phone_revealed"]) {
      expect(lookup(audit.salesActions, action, "")).not.toBe("");
    }
    expect(notices.order_cancelled).not.toBe("");
    expect(notices.manual_payment_recorded).not.toBe("");
  });

  it("العربية من اليمين، وهي الافتراضية", () => {
    expect(adminDirection("ar")).toBe("rtl");
    expect(getAdminDictionary()).toBe(getAdminDictionary("ar"));
  });

  it("رسالة الدخول الفاشل واحدة ولا تذكر سببًا بعينه", () => {
    const text = getAdminDictionary().errors["staff.login_failed"];
    expect(text).not.toMatch(/غير موجود|معطَّل|مقفل الآن/);
  });

  it("lookup يرجع البديل لمفتاح بلا ترجمة، ولا يقرأ خصائص الكائن الموروثة", () => {
    const map = { known: "نص" };
    expect(lookup(map, "known", "بديل")).toBe("نص");
    expect(lookup(map, "missing", "بديل")).toBe("بديل");
    expect(lookup(map, "constructor", "بديل")).toBe("بديل");
    expect(lookup(map, "__proto__", "بديل")).toBe("بديل");
  });
});

describe("تنسيق الوقت في اللوحة", () => {
  const instant = new Date("2026-11-26T21:30:00Z");

  it("بمنطقة النادي الزمنية وأرقام لاتينية وتقويم ميلادي", () => {
    expect(formatDay(instant, "Asia/Riyadh")).toBe("27 نوفمبر 2026");
    expect(formatDay(instant, "UTC")).toBe("26 نوفمبر 2026");
    const text = formatDateTime(instant, "Asia/Riyadh");
    expect(text).toContain("27 نوفمبر 2026");
    expect(text).toContain("12:30");
    expect(text).not.toMatch(/[٠-٩]/);
  });
});
