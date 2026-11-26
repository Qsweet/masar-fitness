/**
 * تفصيل الطلب في اللوحة (ADMIN_A2_SALES §6.2): من اللقطة المختومة فقط، بلا join على الكتالوج، ومعه
 * اشتراكه ومحاولات دفعه وحوادثه ودفعته اليدوية وخطه الزمني من سجل التدقيق. قراءة فقط، والجوال مقنَّع.
 */
import {
  effectiveMembershipStatus,
  isLiveAttempt,
  money,
  plainDateInZone,
  type AttemptStatus,
  type MembershipStatus,
  type Money,
  type PlainDate,
  type RefundStatus,
} from "@masar/domain";
import type { Db } from "../client";
import { plainDateFromColumn } from "../commerce/load-customer";
import { ORDER_VIEW_INCLUDE, toOrderView, type OrderView } from "../commerce/read-order";
import type { Prisma } from "../generated/prisma/client";
import type { AuditRow } from "../staff/read-audit";
import { ADMIN_VISIBLE_PHONE_DIGITS } from "./list-orders";
import { toManualPaymentView, type ManualPaymentView } from "./manual-payment-view";

export interface OrderPaymentView {
  readonly provider: string;
  readonly providerPaymentId: string;
  readonly amount: Money;
  readonly paidAt: Date;
}

export interface OrderMembershipView {
  readonly id: string;
  /** الحالة كما تُعرض: النشط الذي بلغ نهايته منتهٍ. */
  readonly status: MembershipStatus;
  readonly paidMonths: number;
  readonly bonusMonths: number;
  readonly startsOn: PlainDate | null;
  readonly endsOn: PlainDate | null;
}

export interface OrderAttemptView {
  readonly id: string;
  readonly provider: string;
  readonly method: string | null;
  readonly status: AttemptStatus;
  /** حيّة بتعريف `isLiveAttempt`: تمنع الإلغاء والدفع اليدوي. */
  readonly live: boolean;
  readonly amount: Money;
  readonly createdAt: Date;
  readonly endedAt: Date | null;
  readonly settlementResult: string | null;
  readonly failureReason: string | null;
}

export interface OrderIncidentView {
  readonly id: string;
  readonly kind: string;
  readonly openedAt: Date;
  readonly resolvedAt: Date | null;
}

export interface OrderRefundView {
  readonly id: string;
  readonly amount: Money;
  readonly status: RefundStatus;
  readonly requestedAt: Date;
}

export interface OrderDetail {
  readonly order: OrderView;
  readonly customerId: string;
  readonly payment: OrderPaymentView | null;
  readonly cancelledAt: Date | null;
  readonly membership: OrderMembershipView | null;
  readonly attempts: readonly OrderAttemptView[];
  readonly incidents: readonly OrderIncidentView[];
  readonly manualPayment: ManualPaymentView | null;
  readonly refunds: readonly OrderRefundView[];
  /** أحداث الطلب واشتراكه ومحاولاته ودفعته اليدوية، الأقدم أولًا. */
  readonly timeline: readonly AuditRow[];
}

const DETAIL_INCLUDE = {
  ...ORDER_VIEW_INCLUDE,
  memberships: true,
  paymentAttempts: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  paymentIncidents: { orderBy: [{ openedAt: "asc" }, { id: "asc" }] },
  manualPayment: true,
  refunds: { orderBy: [{ requestedAt: "asc" }, { id: "asc" }] },
} as const satisfies Prisma.OrderInclude;

type DetailRow = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function toPayment(row: DetailRow): OrderPaymentView | null {
  const { paidAt, paidProvider, paidProviderPaymentId, paidAmountMinor } = row;
  if (paidAt === null || paidProvider === null || paidProviderPaymentId === null) {
    return null;
  }
  return {
    provider: paidProvider,
    providerPaymentId: paidProviderPaymentId,
    amount: money(paidAmountMinor ?? row.totalMinor, row.paidCurrency ?? row.currency),
    paidAt,
  };
}

function toMembership(row: DetailRow, today: PlainDate): OrderMembershipView | null {
  const membership = row.memberships[0];
  if (membership === undefined) {
    return null;
  }
  const endsOn = membership.endsOn === null ? null : plainDateFromColumn(membership.endsOn);
  return {
    id: membership.id,
    status: effectiveMembershipStatus(membership.status, endsOn, today),
    paidMonths: membership.paidMonths,
    bonusMonths: membership.bonusMonths,
    startsOn: membership.startsOn === null ? null : plainDateFromColumn(membership.startsOn),
    endsOn,
  };
}

function toAttempt(attempt: DetailRow["paymentAttempts"][number]): OrderAttemptView {
  return {
    id: attempt.id,
    provider: attempt.provider,
    method: attempt.method,
    status: attempt.status,
    live: isLiveAttempt(attempt.status, attempt.settledAt !== null),
    amount: money(attempt.amountMinor, attempt.currency),
    createdAt: attempt.createdAt,
    endedAt: attempt.endedAt,
    settlementResult: attempt.settlementResult,
    failureReason: attempt.failureReason,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** الخط الزمني: الفهرس `(entity_type, entity_id, created_at)` يخدم كل كيان. */
async function loadTimeline(db: Db, row: DetailRow): Promise<AuditRow[]> {
  const entities: Prisma.AuditLogWhereInput[] = [
    { entityType: "order", entityId: row.id },
    ...row.memberships.map((item) => ({ entityType: "membership", entityId: item.id })),
    ...row.paymentAttempts.map((item) => ({ entityType: "payment_attempt", entityId: item.id })),
    ...(row.manualPayment === null
      ? []
      : [{ entityType: "manual_payment", entityId: row.manualPayment.id }]),
  ];
  const rows = await db.auditLog.findMany({
    where: { clubId: row.clubId, OR: entities },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((entry) => ({ ...entry, data: isRecord(entry.data) ? entry.data : {} }));
}

/** الطلب بمعرّفه داخل نادي الموظف، أو undefined (معرّف من نادٍ آخر لا يُرى). */
export async function getOrderDetail(
  db: Db,
  clubId: string,
  orderId: string,
  now: Date,
): Promise<OrderDetail | undefined> {
  const row = await db.order.findFirst({ where: { id: orderId, clubId }, include: DETAIL_INCLUDE });
  if (row === null) {
    return undefined;
  }
  const today = plainDateInZone(now, row.club.timezone);
  return {
    order: toOrderView(row, now, ADMIN_VISIBLE_PHONE_DIGITS),
    customerId: row.customerId,
    payment: toPayment(row),
    cancelledAt: row.cancelledAt,
    membership: toMembership(row, today),
    attempts: row.paymentAttempts.map(toAttempt),
    incidents: row.paymentIncidents.map((incident) => ({
      id: incident.id,
      kind: incident.kind,
      openedAt: incident.openedAt,
      resolvedAt: incident.resolvedAt,
    })),
    manualPayment: row.manualPayment === null ? null : toManualPaymentView(row.manualPayment),
    refunds: row.refunds.map((refund) => ({
      id: refund.id,
      amount: money(refund.amountMinor, row.currency),
      status: refund.status,
      requestedAt: refund.requestedAt,
    })),
    timeline: await loadTimeline(db, row),
  };
}
