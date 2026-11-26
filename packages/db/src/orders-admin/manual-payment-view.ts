/** الدفعة اليدوية كما تُعرض في تفصيل الطلب. الملاحظة نص حر يبقى في جدوله ولا يدخل التدقيق. */
import {
  DomainError,
  isManualPaymentMethod,
  money,
  type ManualPaymentMethod,
  type Money,
  type PlainDate,
} from "@masar/domain";
import { plainDateFromColumn } from "../commerce/load-customer";
import type { ManualPayment } from "../generated/prisma/client";

export interface ManualPaymentView {
  readonly id: string;
  readonly method: ManualPaymentMethod;
  readonly externalReference: string;
  readonly receivedOn: PlainDate;
  readonly amount: Money;
  readonly note: string | null;
  /** معرّف الموظف المسجِّل؛ اسمه يُقرأ من قائمة الموظفين عند العرض. */
  readonly recordedBy: string;
  readonly createdAt: Date;
}

export function toManualPaymentView(row: ManualPayment): ManualPaymentView {
  // CHECK القاعدة يحصر الطريقة في القائمة؛ غيرها عطل بيانات لا يُخمَّن
  if (!isManualPaymentMethod(row.method)) {
    throw new DomainError("invariant", "manual_payment.unknown_method");
  }
  return {
    id: row.id,
    method: row.method,
    externalReference: row.externalReference,
    receivedOn: plainDateFromColumn(row.receivedOn),
    amount: money(row.amountMinor, row.currency),
    note: row.note,
    recordedBy: row.recordedBy,
    createdAt: row.createdAt,
  };
}
