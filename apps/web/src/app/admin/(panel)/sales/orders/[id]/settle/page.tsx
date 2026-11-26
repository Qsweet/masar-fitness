import { getOrderDetail } from "@masar/db";
import { formatPlainDate, plainDateInZone } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettleForm } from "@/components/admin/sales/settle-form";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/admin/ui/kit";
import { orderPath } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { formatAmount } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { isCheckoutPreview } from "@/server/checkout/flag";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.orders.settle.title };
}

const DEFAULT_METHOD = "bank_transfer";

/**
 * تسجيل دفع يدوي على طلب معلّق، بخطوتين. في وضع المعاينة الصفحة غير موجودة (طلبات المعاينة للعرض
 * فقط، القرار 59)، والإجراء نفسه يرفض قبل أي قراءة.
 */
export default async function SettleOrderPage(props: PageProps<"/admin/sales/orders/[id]/settle">) {
  const { staff } = await requireStaff("orders.settle");
  const { id } = await props.params;
  const now = new Date();
  const detail =
    isUuid(id) && !isCheckoutPreview()
      ? await getOrderDetail(getDb(), staff.clubId, id, now)
      : undefined;
  if (detail === undefined) {
    notFound();
  }
  const { sales, errors } = getAdminDictionary();
  const text = sales.orders.settle;
  const { order, attempts } = detail;
  const back = (
    <ButtonLink href={orderPath(order.id)} variant="ghost">
      {sales.orders.cancel.back}
    </ButtonLink>
  );
  const open =
    order.effectiveStatus === "pending_payment" && !attempts.some((attempt) => attempt.live);
  if (!open) {
    return (
      <>
        <PageHeader title={text.title}>{back}</PageHeader>
        <Alert tone="warning">{text.unavailable}</Alert>
      </>
    );
  }
  const today = formatPlainDate(plainDateInZone(now, order.timeZone));
  const lead = fill(text.lead, { reference: order.reference, total: formatAmount(order.total) });
  return (
    <>
      <PageHeader title={text.title} description={lead}>
        {back}
      </PageHeader>
      <Alert tone="warning">{text.warning}</Alert>
      <Card narrow>
        <SettleForm
          orderId={order.id}
          reference={order.reference}
          customerName={order.customerName}
          values={{
            method: DEFAULT_METHOD,
            externalReference: "",
            receivedOn: today,
            amount: "",
            note: "",
          }}
          receivedBounds={{
            min: formatPlainDate(plainDateInZone(order.createdAt, order.timeZone)),
            max: today,
          }}
          labels={{ ...text, methods: sales.statuses.manualMethod, errors }}
        />
      </Card>
    </>
  );
}
