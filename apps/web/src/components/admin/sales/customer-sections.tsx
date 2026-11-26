import type { CustomerDetail } from "@masar/db";
import type { PlainDate } from "@masar/domain";
import Link from "next/link";
import { orderPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { formatDateTime, formatPlainDay } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatMonths } from "@/i18n/format";
import { Cell, DataTable } from "../ui/data-table";
import { Badge, Card, EmptyState, type Tone } from "../ui/kit";
import styles from "./sales.module.css";

interface SectionProps {
  readonly customer: CustomerDetail;
  readonly sales: AdminDictionary["sales"];
}

const MEMBERSHIP_TONES = {
  scheduled: "info",
  active: "success",
  frozen: "warning",
  expired: "neutral",
  cancelled: "neutral",
} as const satisfies Readonly<Record<string, Tone>>;

/** اشتراكات العميل بحالتها الفعلية، الأحدث أولًا، وكل اشتراك برابط طلبه. */
export function CustomerMemberships({ customer, sales }: SectionProps) {
  const text = sales.customers.detail;
  const columns = text.membershipColumns;
  const bonus = sales.orders.detail.bonus;
  const day = (date: PlainDate | null) =>
    date === null ? sales.orders.detail.membershipUnscheduled : formatPlainDay(date);
  return (
    <Card title={text.memberships} flush>
      {customer.memberships.length === 0 ? (
        <EmptyState
          icon="account"
          title={text.membershipsEmptyTitle}
          description={text.membershipsEmptyLead}
        />
      ) : (
        <DataTable
          caption={text.memberships}
          columns={Object.values(columns)}
          testId="customer-memberships"
        >
          {customer.memberships.map((membership) => (
            <tr key={membership.id}>
              <Cell label={columns.status}>
                <Badge tone={MEMBERSHIP_TONES[membership.status]}>
                  {sales.statuses.membership[membership.status]}
                </Badge>
              </Cell>
              <Cell label={columns.months}>
                {formatMonths(membership.paidMonths, "ar")}
                {membership.bonusMonths === 0 ? null : (
                  <> {fill(bonus, { bonus: formatMonths(membership.bonusMonths, "ar") })}</>
                )}
              </Cell>
              <Cell label={columns.starts} nowrap>
                {day(membership.startsOn)}
              </Cell>
              <Cell label={columns.ends} nowrap>
                {day(membership.endsOn)}
              </Cell>
              <Cell label={columns.order}>
                <Link
                  href={orderPath(membership.orderId)}
                  prefetch={false}
                  className={styles.rowLink}
                >
                  {text.openOrder}
                </Link>
              </Cell>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}

/** طلبات التقييم إن وُجدت فقط: لا قسم فارغ لما لم يطلبه العميل. */
export function CustomerAssessments({ customer, sales }: SectionProps) {
  if (customer.assessments.length === 0) {
    return null;
  }
  const text = sales.customers.detail;
  const columns = text.assessmentColumns;
  return (
    <Card title={text.assessments} flush>
      <DataTable caption={text.assessments} columns={Object.values(columns)}>
        {customer.assessments.map((request) => (
          <tr key={request.id}>
            <Cell label={columns.service} strong>
              {request.service.ar}
            </Cell>
            <Cell label={columns.requested} muted nowrap>
              {formatDateTime(request.createdAt, customer.timeZone)}
            </Cell>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
