import type { OrderDetail } from "@masar/db";
import type { ReactNode } from "react";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime, formatPlainDay } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatMonths } from "@/i18n/format";
import { Cell, DataTable } from "../ui/data-table";
import { Badge, Card, Facts, Ltr, type Tone } from "../ui/kit";
import { Amount, PaymentMethod } from "./order-parts";
import styles from "./sales.module.css";

type Sales = AdminDictionary["sales"];

interface SectionProps {
  readonly detail: OrderDetail;
  readonly sales: Sales;
  /** أسماء الموظفين بمعرّفاتهم، لمسجِّل الدفعة اليدوية. */
  readonly names: ReadonlyMap<string, string>;
  readonly unknownStaff: string;
}

function manualFacts({ detail, sales, names, unknownStaff }: SectionProps) {
  const manual = detail.manualPayment;
  if (manual === null) {
    return [];
  }
  const text = sales.orders.detail;
  const facts: (readonly [string, ReactNode])[] = [
    [text.manualMethod, sales.statuses.manualMethod[manual.method]],
    [text.manualReference, <Ltr key="external">{manual.externalReference}</Ltr>],
    [text.manualReceivedOn, formatPlainDay(manual.receivedOn)],
    [text.manualRecordedBy, names.get(manual.recordedBy) ?? unknownStaff],
  ];
  if (manual.note !== null) {
    facts.push([text.manualNote, manual.note]);
  }
  return facts;
}

/** الدفع المسجَّل على الطلب، ومعه بيانات الدفعة اليدوية إن كانت يدوية. */
export function OrderPayment(props: SectionProps) {
  const { detail, sales } = props;
  const text = sales.orders.detail;
  const { payment, order } = detail;
  if (payment === null) {
    return (
      <Card title={text.payment}>
        <p className={styles.note}>{text.notPaid}</p>
      </Card>
    );
  }
  const facts: (readonly [string, ReactNode])[] = [
    [
      text.paidWith,
      <PaymentMethod key="method" provider={payment.provider} statuses={sales.statuses} />,
    ],
    [text.paidAt, formatDateTime(payment.paidAt, order.timeZone)],
    [text.paidAmount, <Amount key="amount" value={payment.amount} />],
    ...manualFacts(props),
  ];
  return (
    <Card title={text.payment}>
      <Facts items={facts} />
    </Card>
  );
}

const MEMBERSHIP_TONES = {
  scheduled: "info",
  active: "success",
  frozen: "warning",
  expired: "neutral",
  cancelled: "neutral",
} as const satisfies Readonly<Record<string, Tone>>;

/** الاشتراك الناتج عن الطلب بحالته الفعلية؛ لا بطاقة لطلب بلا اشتراك. */
export function OrderMembership({ detail, sales }: Pick<SectionProps, "detail" | "sales">) {
  const { membership } = detail;
  if (membership === null) {
    return null;
  }
  const text = sales.orders.detail;
  const day = (date: typeof membership.startsOn) =>
    date === null ? text.membershipUnscheduled : formatPlainDay(date);
  const months =
    membership.bonusMonths === 0
      ? formatMonths(membership.paidMonths, "ar")
      : `${formatMonths(membership.paidMonths, "ar")} ${fill(text.bonus, {
          bonus: formatMonths(membership.bonusMonths, "ar"),
        })}`;
  return (
    <Card title={text.membership}>
      <Facts
        items={[
          [
            text.membershipStatus,
            <Badge key="status" tone={MEMBERSHIP_TONES[membership.status]}>
              {sales.statuses.membership[membership.status]}
            </Badge>,
          ],
          [text.membershipMonths, months],
          [text.membershipStarts, day(membership.startsOn)],
          [text.membershipEnds, day(membership.endsOn)],
        ]}
      />
    </Card>
  );
}

const ATTEMPT_TONES = {
  created: "neutral",
  pending: "warning",
  authorized: "info",
  captured: "success",
  failed: "danger",
  voided: "neutral",
  expired: "neutral",
  refunded: "info",
} as const satisfies Readonly<Record<string, Tone>>;

function settlementText(result: string | null, dictionary: AdminDictionary): string {
  const text = dictionary.sales.orders.detail;
  if (result === null) {
    return text.attemptNoResult;
  }
  if (result === "paid" || result === "replayed") {
    return result === "paid" ? text.attemptPaid : text.attemptReplayed;
  }
  return lookup(dictionary.errors, result, result);
}

/** محاولات الدفع قراءةً فقط: المزوّد والوسيلة والحالة والمبلغ ونتيجة التسوية. */
export function OrderAttempts({
  detail,
  dictionary,
}: {
  readonly detail: OrderDetail;
  readonly dictionary: AdminDictionary;
}) {
  if (detail.attempts.length === 0) {
    return null;
  }
  const { sales } = dictionary;
  const text = sales.orders.detail;
  const columns = text.attemptColumns;
  return (
    <Card title={text.attempts} flush>
      <DataTable caption={text.attempts} columns={Object.values(columns)} testId="order-attempts">
        {detail.attempts.map((attempt) => (
          <tr key={attempt.id}>
            <Cell label={columns.started} muted nowrap>
              {formatDateTime(attempt.createdAt, detail.order.timeZone)}
            </Cell>
            <Cell label={columns.provider}>
              <Ltr>{attempt.provider}</Ltr>
            </Cell>
            <Cell label={columns.method} muted={attempt.method === null}>
              {attempt.method === null ? "—" : <Ltr>{attempt.method}</Ltr>}
            </Cell>
            <Cell label={columns.status}>
              <Badge tone={ATTEMPT_TONES[attempt.status]}>
                {sales.statuses.attempt[attempt.status]}
              </Badge>
            </Cell>
            <Cell label={columns.amount} nowrap>
              <Amount value={attempt.amount} />
            </Cell>
            <Cell label={columns.result}>
              {settlementText(attempt.settlementResult, dictionary)}
            </Cell>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}

/** حوادث الدفع قراءةً فقط (حسمها في مرحلة الدفع من اللوحة). */
export function OrderIncidents({ detail, sales }: Pick<SectionProps, "detail" | "sales">) {
  if (detail.incidents.length === 0) {
    return null;
  }
  const text = sales.orders.detail;
  const columns = text.incidentColumns;
  const when = (date: Date) => formatDateTime(date, detail.order.timeZone);
  return (
    <Card title={text.incidents} flush>
      <DataTable caption={text.incidents} columns={Object.values(columns)} testId="order-incidents">
        {detail.incidents.map((incident) => (
          <tr key={incident.id}>
            <Cell label={columns.kind} strong>
              {lookup(sales.statuses.incident, incident.kind, incident.kind)}
            </Cell>
            <Cell label={columns.opened} muted nowrap>
              {when(incident.openedAt)}
            </Cell>
            <Cell label={columns.resolved}>
              {incident.resolvedAt === null ? (
                <Badge tone="warning">{text.incidentOpen}</Badge>
              ) : (
                when(incident.resolvedAt)
              )}
            </Cell>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}

/** صفوف الاسترداد حين توجد فقط: لا كاتب لها من اللوحة بعد، ولا قسم فارغ. */
export function OrderRefunds({ detail, sales }: Pick<SectionProps, "detail" | "sales">) {
  if (detail.refunds.length === 0) {
    return null;
  }
  const text = sales.orders.detail;
  const columns = text.refundColumns;
  return (
    <Card title={text.refunds} flush>
      <DataTable caption={text.refunds} columns={Object.values(columns)}>
        {detail.refunds.map((refund) => (
          <tr key={refund.id}>
            <Cell label={columns.requested} muted nowrap>
              {formatDateTime(refund.requestedAt, detail.order.timeZone)}
            </Cell>
            <Cell label={columns.amount} nowrap>
              <Amount value={refund.amount} />
            </Cell>
            <Cell label={columns.status}>{sales.statuses.refund[refund.status]}</Cell>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
