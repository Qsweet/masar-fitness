import { randomUUID } from "node:crypto";
import { isProductAdminKind } from "@masar/domain";
import type { Metadata } from "next";
import { PlanCreateForm } from "@/components/admin/sales/plan-forms";
import { PageHeader } from "@/components/admin/ui/kit";
import { getAdminDictionary } from "@/i18n/admin";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.plans.new.title.membership };
}

/**
 * منتج جديد (اشتراك أو إضافة بحسب `?kind=`). يُنشأ مسودة. معرّف المنتج يولَّد هنا ويُرسل مخفيًا: الإرسال
 * المزدوج لا ينشئ منتجين.
 */
export default async function NewPlanPage(props: PageProps<"/admin/sales/plans/new">) {
  await requireStaff("catalog.write");
  const query = await props.searchParams;
  const kind = isProductAdminKind(query.kind) ? query.kind : "membership";
  const { sales, errors } = getAdminDictionary();
  const text = sales.plans;
  return (
    <>
      <PageHeader title={text.new.title[kind]} description={text.new.lead} />
      <PlanCreateForm
        productId={randomUUID()}
        kind={kind}
        values={{ sortOrder: "0" }}
        labels={text.form}
        text={text.new}
        errors={errors}
      />
    </>
  );
}
