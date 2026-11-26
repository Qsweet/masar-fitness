import { getOrderDetail } from "@masar/db";
import { ORDER_CANCEL_REASONS } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import salesStyles from "@/components/admin/sales/sales.module.css";
import { SelectField } from "@/components/admin/ui/fields";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/admin/ui/kit";
import { orderPath } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { cancelOrderAction } from "@/server/admin/actions/sales-cancel";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.orders.cancel.title };
}

/**
 * تأكيد إلغاء طلب معلّق: السبب من قائمة مغلقة، والعواقب مكتوبة قبل الزر. صفحة من الخادم (بلا
 * `confirm()` من المتصفح) فتعمل بلا JavaScript.
 */
export default async function CancelOrderPage(props: PageProps<"/admin/sales/orders/[id]/cancel">) {
  const { staff } = await requireStaff("orders.cancel");
  const { id } = await props.params;
  const detail = isUuid(id)
    ? await getOrderDetail(getDb(), staff.clubId, id, new Date())
    : undefined;
  if (detail === undefined) {
    notFound();
  }
  const { sales, errors } = getAdminDictionary();
  const text = sales.orders.cancel;
  const { order, attempts } = detail;
  const back = (
    <ButtonLink href={orderPath(order.id)} variant="ghost">
      {text.back}
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
  return (
    <>
      <PageHeader title={text.title} description={fill(text.lead, { reference: order.reference })}>
        {back}
      </PageHeader>
      <Card title={text.consequencesTitle} narrow>
        <div className={salesStyles.stack}>
          <ul className={salesStyles.consequences}>
            {text.consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <AdminForm
            action={cancelOrderAction}
            labels={{ submit: text.submit, errors }}
            variant="danger"
          >
            <input type="hidden" name="orderId" value={order.id} />
            <SelectField
              id="cancel-reason"
              name="reason"
              label={text.reason}
              options={ORDER_CANCEL_REASONS.map((reason) => ({
                value: reason,
                label: text.reasons[reason],
              }))}
            />
          </AdminForm>
        </div>
      </Card>
    </>
  );
}
