import { getOrderDetail, listStaff, type OrderDetail } from "@masar/db";
import { hasPermission, type StaffRole } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDiscounts, OrderItems } from "@/components/admin/sales/order-lines";
import { OrderStatusBadge } from "@/components/admin/sales/order-parts";
import {
  OrderAttempts,
  OrderIncidents,
  OrderMembership,
  OrderPayment,
  OrderRefunds,
} from "@/components/admin/sales/order-payments";
import { OrderFacts, OrderTotals } from "@/components/admin/sales/order-summary";
import { OrderTimeline } from "@/components/admin/sales/order-timeline";
import { RevealPhone } from "@/components/admin/sales/reveal-phone";
import salesStyles from "@/components/admin/sales/sales.module.css";
import {
  Alert,
  ButtonLink,
  CardGrid,
  Notice,
  noticeText,
  PageHeader,
} from "@/components/admin/ui/kit";
import { orderCancelPath, orderSettlePath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { requireStaff } from "@/server/admin/guard";
import { isUuid } from "@/server/admin/form";
import { timelineEvents } from "@/server/admin/sales/timeline";
import { isCheckoutPreview } from "@/server/checkout/flag";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.breadcrumbs.order };
}

interface ActionsProps {
  readonly detail: OrderDetail;
  readonly role: StaffRole;
  readonly text: AdminDictionary["sales"]["orders"]["detail"];
}

/**
 * أفعال الطلب المسموحة الآن: المعلّق الذي لم يبلغ مهلته وبلا محاولة حيّة يُلغى ويُسجَّل له دفع يدوي،
 * كلٌّ بصلاحيته. زر الدفع اليدوي لا يُرسم في وضع المعاينة أصلًا. الصفحتان تعيدان الفحص، والقاعدة بعدهما.
 */
function OrderActions({ detail, role, text }: ActionsProps) {
  const { order, attempts } = detail;
  const open =
    order.effectiveStatus === "pending_payment" && !attempts.some((attempt) => attempt.live);
  const canSettle = open && hasPermission(role, "orders.settle") && !isCheckoutPreview();
  const canCancel = open && hasPermission(role, "orders.cancel");
  return (
    <>
      {canSettle ? (
        <ButtonLink href={orderSettlePath(order.id)} variant="primary">
          {text.settle}
        </ButtonLink>
      ) : null}
      {canCancel ? <ButtonLink href={orderCancelPath(order.id)}>{text.cancel}</ButtonLink> : null}
    </>
  );
}

interface AsideProps {
  readonly detail: OrderDetail;
  readonly dictionary: AdminDictionary;
  readonly names: ReadonlyMap<string, string>;
}

/** العمود المجاور لبيانات الطلب: المجاميع، ثم الدفع، ثم الاشتراك إن وُجد. */
function OrderAside({ detail, dictionary, names }: AsideProps) {
  const { sales, audit } = dictionary;
  return (
    <div className={salesStyles.stack}>
      <OrderTotals detail={detail} sales={sales} />
      <OrderPayment detail={detail} sales={sales} names={names} unknownStaff={audit.unknownStaff} />
      <OrderMembership detail={detail} sales={sales} />
    </div>
  );
}

async function staffNames(clubId: string): Promise<Map<string, string>> {
  const members = await listStaff(getDb(), clubId);
  return new Map(members.map((member) => [member.id, member.displayName]));
}

/** تفصيل الطلب من لقطته المختومة: بياناته وسطوره ومجاميعه ودفعه واشتراكه وخطه الزمني. قراءة فقط. */
export default async function OrderPage(props: PageProps<"/admin/sales/orders/[id]">) {
  const { staff } = await requireStaff("orders.read");
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const detail = isUuid(id)
    ? await getOrderDetail(getDb(), staff.clubId, id, new Date())
    : undefined;
  if (detail === undefined) {
    notFound();
  }
  const dictionary = getAdminDictionary();
  const { sales, errors } = dictionary;
  const text = sales.orders.detail;
  const { order } = detail;
  const names = await staffNames(staff.clubId);
  const reveal = hasPermission(staff.role, "customers.reveal_phone") ? (
    <RevealPhone source="order" id={order.id} labels={{ ...sales.customers.reveal, errors }} />
  ) : null;
  const waiting =
    order.effectiveStatus === "pending_payment" && detail.attempts.some((a) => a.live);
  return (
    <>
      <PageHeader
        title={fill(text.title, { reference: order.reference })}
        badge={<OrderStatusBadge status={order.effectiveStatus} statuses={sales.statuses} />}
      >
        <OrderActions detail={detail} role={staff.role} text={text} />
      </PageHeader>
      <Notice text={noticeText(query.done, dictionary)} />
      {waiting ? <Alert tone="info">{text.liveAttempt}</Alert> : null}
      <CardGrid>
        {/* حاوية: البطاقة بارتفاعها لا بارتفاع العمود المجاور */}
        <div>
          <OrderFacts
            detail={detail}
            sales={sales}
            reveal={reveal}
            showCustomerLink={hasPermission(staff.role, "customers.read")}
          />
        </div>
        <OrderAside detail={detail} dictionary={dictionary} names={names} />
      </CardGrid>
      <OrderItems order={order} sales={sales} />
      <OrderDiscounts order={order} sales={sales} />
      <OrderAttempts detail={detail} dictionary={dictionary} />
      <OrderIncidents detail={detail} sales={sales} />
      <OrderRefunds detail={detail} sales={sales} />
      <OrderTimeline
        events={timelineEvents(detail.timeline, names, dictionary)}
        text={sales.orders.timeline}
        timezone={order.timeZone}
      />
    </>
  );
}
