import {
  getPromotionDetail,
  getSalesSettings,
  listPromotionProductOptions,
  type PromotionAdminRow,
} from "@masar/db";
import { hasPermission, promotionEditPolicy } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PromotionStateBadge } from "@/components/admin/sales/catalog-parts";
import { PromotionForm } from "@/components/admin/sales/promotion-form";
import {
  PromotionFactsCard,
  PromotionUsageCard,
} from "@/components/admin/sales/promotion-sections";
import {
  Alert,
  ButtonLink,
  CardGrid,
  Notice,
  noticeText,
  PageHeader,
} from "@/components/admin/ui/kit";
import { ADMIN_ROUTES, promotionStatusPath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { savePromotionAction } from "@/server/admin/actions/sales-promotions";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { promotionFormValues } from "@/server/admin/sales/promotion-form";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.breadcrumbs.promotion };
}

type DetailText = AdminDictionary["sales"]["promotions"]["detail"];

/** أزرار الانتقال المسموحة الآن (كل زر رابط إلى صفحة تأكيده)، وزر النسخة. */
function Actions({ row, text }: { readonly row: PromotionAdminRow; readonly text: DetailText }) {
  const { id, status } = row.rule;
  const href = (to: string): string => `${promotionStatusPath(id)}?to=${to}`;
  return (
    <>
      {status === "draft" || status === "paused" ? (
        <ButtonLink href={href("activate")} variant="primary">
          {status === "paused" ? text.reactivate : text.activate}
        </ButtonLink>
      ) : null}
      {status === "active" ? <ButtonLink href={href("pause")}>{text.pause}</ButtonLink> : null}
      {status === "archived" ? null : (
        <ButtonLink href={href("end")} variant="ghost">
          {text.end}
        </ButtonLink>
      )}
      <ButtonLink href={`${ADMIN_ROUTES.promotionsNew}?from=${id}`} variant="ghost">
        {text.copy}
      </ButtonLink>
    </>
  );
}

function policyOf(row: PromotionAdminRow) {
  return promotionEditPolicy({
    status: row.rule.status,
    hasRedemptions: row.usage.total > 0,
    audience: row.rule.audience,
  });
}

/** لماذا لا يُعدَّل، أو ما الذي جُمِّد؛ undefined حين يُعدَّل كله. */
function editNote(row: PromotionAdminRow, text: DetailText): string | undefined {
  const policy = policyOf(row);
  if (policy.lock === "archived") {
    return text.archivedNote;
  }
  if (policy.lock === "restricted_audience") {
    return text.restrictedNote;
  }
  return policy.terms ? undefined : text.frozen;
}

/**
 * صفحة العرض: شروطه، وعدّادات استخدامه من الطلبات نفسها، ونموذج تعديله بحسب `promotionEditPolicy`
 * (بعد أول استخدام تُجمَّد شروط الخصم). دور المبيعات يقرأ بلا أزرار ولا نموذج.
 */
export default async function PromotionPage(props: PageProps<"/admin/sales/promotions/[id]">) {
  const { staff } = await requireStaff("promotions.read");
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const db = getDb();
  const row = isUuid(id) ? await getPromotionDetail(db, staff.clubId, id, new Date()) : undefined;
  if (row === undefined) {
    notFound();
  }
  const [club, options] = await Promise.all([
    getSalesSettings(db, staff.clubId),
    listPromotionProductOptions(
      db,
      staff.clubId,
      row.rule.scope.kind === "listed_products" ? row.rule.scope.productIds : [],
    ),
  ]);
  const dictionary = getAdminDictionary();
  const { sales, errors } = dictionary;
  const text = sales.promotions;
  const canWrite = hasPermission(staff.role, "promotions.write");
  const policy = policyOf(row);
  const editable = canWrite && policy.editable;
  const note = canWrite ? editNote(row, text.detail) : undefined;
  return (
    <>
      <PageHeader
        title={row.rule.name.ar}
        description={row.rule.code === null ? text.types.automatic : text.types.coupon}
        badge={<PromotionStateBadge state={row.state} statuses={sales.statuses} />}
      >
        {canWrite ? <Actions row={row} text={text.detail} /> : null}
      </PageHeader>
      <Notice text={noticeText(query.done, dictionary)} />
      <CardGrid>
        <PromotionFactsCard row={row} dictionary={dictionary} timezone={club.timezone} />
        <PromotionUsageCard row={row} dictionary={dictionary} />
      </CardGrid>
      {note === undefined ? null : <Alert tone="info">{note}</Alert>}
      {editable ? (
        <PromotionForm
          action={savePromotionAction}
          promotionId={row.rule.id}
          lockToken={row.lockToken}
          creating={false}
          termsEditable={policy.terms}
          values={promotionFormValues(row, club.timezone)}
          products={options.map((option) => ({
            id: option.id,
            label: `${option.name.ar} (${sales.statuses.itemKind[option.kind]})`,
          }))}
          timezone={club.timezone}
          labels={text.form}
          types={text.types}
          submit={text.form.save}
          errors={errors}
        />
      ) : null}
    </>
  );
}
