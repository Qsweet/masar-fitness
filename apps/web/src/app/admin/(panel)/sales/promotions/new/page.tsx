import { randomUUID } from "node:crypto";
import { getPromotionDetail, getSalesSettings, listPromotionProductOptions } from "@masar/db";
import type { Metadata } from "next";
import { PromotionForm } from "@/components/admin/sales/promotion-form";
import { PageHeader } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { createPromotionAction } from "@/server/admin/actions/sales-promotions";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { copiedPromotionValues, emptyPromotionValues } from "@/server/admin/sales/promotion-form";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.promotions.new.title };
}

/**
 * عرض جديد، أو نسخة من عرض قائم (`?from=`): الحقول نفسها بلا رمزه. يُنشأ مسودة. المعرّف يولَّد هنا
 * ويُرسل مخفيًا: الإرسال المزدوج لا ينشئ عرضين.
 */
export default async function NewPromotionPage(props: PageProps<"/admin/sales/promotions/new">) {
  const { staff } = await requireStaff("promotions.write");
  const query = await props.searchParams;
  const db = getDb();
  const now = new Date();
  const from = typeof query.from === "string" && isUuid(query.from) ? query.from : undefined;
  const [club, options, source] = await Promise.all([
    getSalesSettings(db, staff.clubId),
    listPromotionProductOptions(db, staff.clubId),
    from === undefined ? undefined : getPromotionDetail(db, staff.clubId, from, now),
  ]);
  const { sales, errors } = getAdminDictionary();
  const text = sales.promotions;
  const values =
    source === undefined
      ? emptyPromotionValues(now, club.timezone)
      : copiedPromotionValues(source, now, club.timezone);
  return (
    <>
      <PageHeader
        title={source === undefined ? text.new.title : text.new.copyTitle}
        description={source === undefined ? text.new.lead : text.new.copyLead}
      />
      <PromotionForm
        action={createPromotionAction}
        promotionId={randomUUID()}
        creating
        termsEditable
        values={values}
        products={options.map((option) => ({
          id: option.id,
          label: `${option.name.ar} (${sales.statuses.itemKind[option.kind]})`,
        }))}
        timezone={club.timezone}
        labels={text.form}
        types={text.types}
        submit={text.new.submit}
        cancel={{ href: ADMIN_ROUTES.promotions, label: text.new.cancel }}
        errors={errors}
      />
    </>
  );
}
