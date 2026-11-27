import { money, type OrderStatus } from "@masar/domain";
import type { RecentOrder } from "@masar/db";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { moneyParts } from "@/i18n/format";
import type { ActivityItem } from "@/server/admin/overview-view";
import type { SystemStatus } from "@/server/admin/system-status";
import { backupRows } from "../backup/backup-rows";
import { Cell, DataTable } from "../ui/data-table";
import { Badge, Card, CardLink, EmptyState, Ltr, type Tone } from "../ui/kit";
import styles from "./overview.module.css";
import { When, type WhenProps } from "./when";

type OverviewText = AdminDictionary["overview"];

const STATUS_TONES: Readonly<Record<OrderStatus, Tone>> = {
  pending_payment: "warning",
  paid: "success",
  fulfilled: "success",
  expired: "neutral",
  cancelled: "neutral",
  partially_refunded: "info",
  refunded: "info",
};

interface RecentOrdersProps extends Omit<WhenProps, "at"> {
  readonly orders: readonly RecentOrder[];
  readonly text: OverviewText;
}

export function RecentOrders({ orders, text, now, timezone }: RecentOrdersProps) {
  const { columns } = text.orders;
  return (
    <Card title={text.orders.title} flush>
      {orders.length === 0 ? (
        <EmptyState
          icon="orders"
          title={text.orders.emptyTitle}
          description={text.orders.emptyLead}
        />
      ) : (
        <DataTable
          caption={text.orders.title}
          columns={Object.values(columns)}
          testId="recent-orders"
        >
          {orders.map((order) => {
            const total = moneyParts(money(order.totalMinor, order.currency), "ar");
            return (
              <tr key={order.id}>
                <Cell label={columns.reference} strong nowrap>
                  <Ltr>{order.reference}</Ltr>
                </Cell>
                <Cell label={columns.customer} muted nowrap>
                  <Ltr>
                    {text.orders.phoneMask}
                    {order.phoneLast4}
                  </Ltr>
                </Cell>
                <Cell label={columns.item}>{order.itemNameAr}</Cell>
                <Cell label={columns.total} nowrap>
                  <bdi>{total.amount}</bdi> {total.unit}
                </Cell>
                <Cell label={columns.status}>
                  <Badge tone={STATUS_TONES[order.status]}>
                    {text.orderStatuses[order.status]}
                  </Badge>
                </Cell>
                <Cell label={columns.time} muted nowrap>
                  <When at={order.createdAt} now={now} timezone={timezone} />
                </Cell>
              </tr>
            );
          })}
        </DataTable>
      )}
    </Card>
  );
}

interface ActivityFeedProps extends Omit<WhenProps, "at"> {
  readonly items: readonly ActivityItem[];
  readonly text: OverviewText["activity"];
}

export function ActivityFeed({ items, text, now, timezone }: ActivityFeedProps) {
  const all = <CardLink href={ADMIN_ROUTES.audit}>{text.all}</CardLink>;
  return (
    <Card title={text.title} action={all} flush>
      {items.length === 0 ? (
        <EmptyState icon="activity" title={text.emptyTitle} />
      ) : (
        <ol className={styles.feed} data-testid="activity-feed">
          {items.map((item) => (
            <li key={item.id} className={styles.feedItem}>
              <span>{item.sentence}</span>
              <span className={styles.feedTime}>
                <When at={item.at} now={now} timezone={timezone} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const CHECKOUT_TONES = { open: "success", preview: "info", closed: "neutral" } as const;

interface SystemCardProps extends Omit<WhenProps, "at"> {
  readonly status: SystemStatus;
  readonly text: OverviewText["system"];
  readonly backupText: AdminDictionary["backup"];
}

export function SystemCard({ status, text, backupText, now, timezone }: SystemCardProps) {
  const payments =
    status.payments.mode === "off" ? (
      <Badge>{text.paymentsOff}</Badge>
    ) : (
      <Badge tone="info">{fill(text.paymentsTest, { provider: status.payments.provider })}</Badge>
    );
  const covered = status.mfa.enrolled === status.mfa.active;
  const rows = [
    [
      text.checkout,
      <Badge key="checkout" tone={CHECKOUT_TONES[status.checkout]}>
        {text.checkoutStates[status.checkout]}
      </Badge>,
    ],
    [text.payments, payments],
    [
      text.indexing,
      <Badge key="indexing" tone={status.indexing === "on" ? "success" : "neutral"}>
        {text.indexingStates[status.indexing]}
      </Badge>,
    ],
    [
      text.mfa,
      <Badge key="mfa" tone={covered ? "success" : "warning"}>
        {fill(text.mfaCoverage, {
          enrolled: String(status.mfa.enrolled),
          active: String(status.mfa.active),
        })}
      </Badge>,
    ],
    ...backupRows(status.backup, backupText, { now, timezone }),
    [text.version, <Ltr key="version">{status.version}</Ltr>],
  ] as const;
  return (
    <Card title={text.title} flush>
      <dl className={styles.status} data-testid="system-status">
        {rows.map(([label, value]) => (
          <div key={label} className={styles.statusRow}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export { styles as overviewStyles };
