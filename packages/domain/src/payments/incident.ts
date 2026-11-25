/** أنواع حوادث الدفع بترتيب CHECK القاعدة `payment_incidents_kind_known`. */
export const INCIDENT_KINDS = [
  "late_payment_not_payable",
  "amount_mismatch",
  "currency_mismatch",
  "order_already_paid",
  "payment_already_used",
  "coupon_applied_by_provider",
  "unknown_reference",
  "provider_reversed",
  "stuck_pending",
  "capture_blocked",
  "capture_failed",
] as const;

export type IncidentKind = (typeof INCIDENT_KINDS)[number];

/** قيم بسيطة فقط، بلا اسم ولا جوال (فحص المفاتيح نفسه في `writeAudit`). */
export type IncidentData = Readonly<Record<string, string | number | boolean | null>>;

export interface IncidentNote {
  readonly kind: IncidentKind;
  readonly data: IncidentData;
}

/** سبب رفض `markOrderPaid` ⇒ نوع الحادثة التي تنبّه الإدارة. لا تفعيل ولا استرداد آلي. */
const KIND_BY_REJECTION: Readonly<Record<string, IncidentKind>> = {
  "order.not_payable": "late_payment_not_payable",
  "payment.amount_mismatch": "amount_mismatch",
  "payment.currency_mismatch": "currency_mismatch",
  "order.already_paid": "order_already_paid",
  "payment.already_used": "payment_already_used",
  "payment.invalid_reference": "unknown_reference",
  "order.not_found": "unknown_reference",
};

/** نوع الحادثة لرفض تسوية، أو undefined لسبب ليس نتيجة عمل معروفة (عطل يُرمى لا حادثة). */
export function incidentKindForRejection(reason: string): IncidentKind | undefined {
  return Object.hasOwn(KIND_BY_REJECTION, reason) ? KIND_BY_REJECTION[reason] : undefined;
}
