import type { Money, OrderStatus } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { moneyParts } from "@/i18n/format";
import { relativeTime } from "@/server/admin/overview-view";
import { paymentLabel } from "@/server/admin/sales/order-view";
import { Badge, type Tone } from "../ui/kit";

/** أجزاء صغيرة مشتركة بين قوائم المبيعات وتفصيلها. الحالات والنصوص من القاموس وحده. */
export const ORDER_STATUS_TONES: Readonly<Record<OrderStatus, Tone>> = {
  pending_payment: "warning",
  paid: "success",
  fulfilled: "success",
  expired: "neutral",
  cancelled: "neutral",
  partially_refunded: "info",
  refunded: "info",
};

type Statuses = AdminDictionary["sales"]["statuses"];

export function OrderStatusBadge({
  status,
  statuses,
}: {
  readonly status: OrderStatus;
  readonly statuses: Statuses;
}) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{statuses.order[status]}</Badge>;
}

/** مبلغ بوحدته: الرقم معزول الاتجاه، والهللات تظهر إن وُجدت. */
export function Amount({ value }: { readonly value: Money }) {
  const { amount, unit } = moneyParts(value, "ar");
  return (
    <>
      <bdi>{amount}</bdi> {unit}
    </>
  );
}

interface WhenProps {
  readonly at: Date;
  readonly now: Date;
  readonly timezone: string;
}

/** وقت نسبي قصير، والتاريخ الكامل بمنطقة النادي في التلميح وبعد أسبوع. */
export function When({ at, now, timezone }: WhenProps) {
  const full = formatDateTime(at, timezone);
  return (
    <time dateTime={at.toISOString()} title={full}>
      {relativeTime(at, now) ?? full}
    </time>
  );
}

/** طريقة الدفع باسمها من القاموس: يدوي بطريقته، أو اسم المزوّد، أو شرطة لما لم يُدفع. */
export function PaymentMethod({
  provider,
  manualMethod,
  statuses,
}: {
  readonly provider: string | null;
  readonly manualMethod: string | null;
  readonly statuses: Statuses;
}) {
  const label = paymentLabel(provider, manualMethod, statuses);
  return provider === null ? <span aria-label={label}>—</span> : label;
}
