import type { OrderDetail } from "@masar/db";
import type { ReactNode } from "react";
import { customerPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fillNodes } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import { Card, CardLink, Facts, Ltr } from "../ui/kit";
import { Amount, OrderStatusBadge } from "./order-parts";
import styles from "./sales.module.css";

type Sales = AdminDictionary["sales"];

interface OrderFactsProps {
  readonly detail: OrderDetail;
  readonly sales: Sales;
  /** زر كشف الجوال لمن يملك صلاحيته. */
  readonly reveal: ReactNode;
  /** رابط صفحة العميل لمن يملك قراءتها. */
  readonly showCustomerLink: boolean;
}

/** بيانات الطلب من لقطته: المرجع والحالة الفعلية والأوقات والاسم والجوال المقنَّع. */
export function OrderFacts({ detail, sales, reveal, showCustomerLink }: OrderFactsProps) {
  const { order, cancelledAt } = detail;
  const text = sales.orders.detail;
  const when = (date: Date) => formatDateTime(date, order.timeZone);
  const facts: (readonly [string, ReactNode])[] = [
    [text.reference, <Ltr key="reference">{order.reference}</Ltr>],
    [
      text.status,
      <OrderStatusBadge key="status" status={order.effectiveStatus} statuses={sales.statuses} />,
    ],
    [text.created, when(order.createdAt)],
  ];
  if (order.status === "pending_payment") {
    facts.push([text.expires, when(order.expiresAt)]);
  }
  if (cancelledAt !== null) {
    facts.push([text.cancelledAt, when(cancelledAt)]);
  }
  facts.push(
    [text.customer, order.customerName],
    [
      text.phone,
      <div key="phone">
        <Ltr>
          <span data-testid="masked-phone">{order.maskedPhone}</span>
        </Ltr>
        {reveal}
      </div>,
    ],
    [text.locale, text.locales[order.locale]],
  );
  const link = showCustomerLink ? (
    <CardLink href={customerPath(detail.customerId)}>{text.customerPage}</CardLink>
  ) : undefined;
  return (
    <Card title={text.facts} action={link}>
      <Facts items={facts} />
    </Card>
  );
}

const BASIS_POINTS_PER_PERCENT = 100;

/** نسبة مختومة بنقاط الأساس ← «15%» أو «7.5%». */
function percent(rateBps: number): string {
  return `${String(rateBps / BASIS_POINTS_PER_PERCENT)}%`;
}

/** المجاميع كما خُتمت على الطلب، ونسبة الضريبة المختومة. لا حساب هنا: الأرقام من اللقطة. */
export function OrderTotals({ detail, sales }: Pick<OrderFactsProps, "detail" | "sales">) {
  const { order } = detail;
  const text = sales.orders.detail;
  return (
    <Card title={text.totals}>
      <dl className={styles.totals} data-testid="order-totals">
        <div className={styles.totalRow}>
          <dt>{text.subtotal}</dt>
          <dd>
            <Amount value={order.subtotal} />
          </dd>
        </div>
        {order.discount.amountMinor === 0 ? null : (
          <div className={styles.totalRow}>
            <dt>{text.discount}</dt>
            <dd>
              − <Amount value={order.discount} />
            </dd>
          </div>
        )}
        <div className={cx(styles.totalRow, styles.grand)}>
          <dt>{text.total}</dt>
          <dd>
            <Amount value={order.total} />
          </dd>
        </div>
        <div className={styles.totalRow}>
          <dt>
            {fillNodes(text.vat, { rate: <bdi key="rate">{percent(order.vatRateBps)}</bdi> })}
          </dt>
          <dd>
            <Amount value={order.vat} />
          </dd>
        </div>
      </dl>
    </Card>
  );
}
