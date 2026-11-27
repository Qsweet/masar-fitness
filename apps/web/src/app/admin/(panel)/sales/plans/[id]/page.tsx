import {
  getCatalogProduct,
  getSalesSettings,
  listClubMembershipPlans,
  type CatalogProductDetail,
} from "@masar/db";
import { hasPermission, isProductAdminKind, type StaffRole } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductStatusBadge } from "@/components/admin/sales/catalog-parts";
import { PlanIdentityForm, PlanTermsForm } from "@/components/admin/sales/plan-forms";
import { PlanPreviewCard } from "@/components/admin/sales/plan-preview-card";
import { CurrentTermsCard, VersionHistoryCard } from "@/components/admin/sales/plan-pricing";
import {
  PlanFactsCard,
  PlanIdentityFacts,
  PlanLinksCard,
} from "@/components/admin/sales/plan-sections";
import {
  Alert,
  ButtonLink,
  Card,
  CardGrid,
  Notice,
  noticeText,
  PageHeader,
  Tabs,
} from "@/components/admin/ui/kit";
import { planPath, planStatusPath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { identityValues, termsValues } from "@/server/admin/sales/plan-form";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.breadcrumbs.plan };
}

const TABS = ["details", "pricing", "preview"] as const;
type Tab = (typeof TABS)[number];

interface View {
  readonly product: CatalogProductDetail;
  readonly dictionary: AdminDictionary;
  readonly role: StaffRole;
}

/** أزرار الحالة المسموحة الآن: كل زر رابط إلى صفحة تأكيده. */
function StatusActions({ product, dictionary, role }: View) {
  if (!hasPermission(role, "catalog.publish") || !isProductAdminKind(product.kind)) {
    return null;
  }
  const text = dictionary.sales.plans.detail;
  const href = (to: string): string => `${planStatusPath(product.id)}?to=${to}`;
  return (
    <>
      {product.status === "active" ? (
        <ButtonLink href={href("unpublish")}>{text.unpublish}</ButtonLink>
      ) : (
        <ButtonLink href={href("publish")} variant="primary">
          {product.status === "archived" ? text.republish : text.publish}
        </ButtonLink>
      )}
      {product.status === "archived" ? null : (
        <ButtonLink href={href("archive")} variant="ghost">
          {text.archive}
        </ButtonLink>
      )}
    </>
  );
}

function DetailsTab({ product, dictionary, role, timezone }: View & { timezone: string }) {
  const { sales, errors } = dictionary;
  const canWrite = hasPermission(role, "catalog.write");
  const editable = canWrite && isProductAdminKind(product.kind) ? product.kind : undefined;
  return (
    <>
      <CardGrid>
        <PlanFactsCard product={product} sales={sales} timezone={timezone} />
        <PlanLinksCard product={product} sales={sales} canWrite={canWrite} errors={errors} />
      </CardGrid>
      {editable === undefined ? (
        <PlanIdentityFacts product={product} sales={sales} />
      ) : (
        <Card title={sales.plans.form.identityTitle} description={sales.plans.form.identityLead}>
          <PlanIdentityForm
            productId={product.id}
            kind={editable}
            lockToken={product.lockToken}
            values={identityValues(product)}
            labels={sales.plans.form}
            errors={errors}
          />
        </Card>
      )}
    </>
  );
}

interface PricingProps extends View {
  readonly timezone: string;
  readonly vatRateBps: number;
  readonly now: Date;
}

function PricingTab({ product, dictionary, role, timezone, vatRateBps, now }: PricingProps) {
  const { sales, errors } = dictionary;
  const text = sales.plans;
  const editable =
    hasPermission(role, "catalog.write") && isProductAdminKind(product.kind)
      ? product.kind
      : undefined;
  const blocked = product.status === "active" && !hasPermission(role, "catalog.publish");
  return (
    <>
      <CurrentTermsCard product={product} text={text} vatRateBps={vatRateBps} />
      {editable === undefined ? null : (
        <Card title={text.detail.termsFormTitle} description={text.detail.termsFormLead}>
          {blocked ? (
            <Alert tone="info">{text.detail.termsNeedPublish}</Alert>
          ) : (
            <PlanTermsForm
              productId={product.id}
              kind={editable}
              lockToken={product.lockToken}
              values={termsValues(product)}
              labels={text.form}
              errors={errors}
              confirm={text.termsConfirm}
            />
          )}
        </Card>
      )}
      <VersionHistoryCard product={product} text={text} timezone={timezone} now={now} />
    </>
  );
}

/**
 * صفحة المنتج بثلاثة تبويبات (روابط `?tab=`): التفاصيل، السعر والمزايا وسجل النسخ، ومعاينة البطاقة كما
 * يراها العميل. النماذج والأزرار بحسب صلاحية الموظف؛ دور المبيعات يقرأ ولا يعدّل.
 */
export default async function PlanPage(props: PageProps<"/admin/sales/plans/[id]">) {
  const { staff } = await requireStaff("catalog.read");
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const db = getDb();
  const now = new Date();
  const product = isUuid(id) ? await getCatalogProduct(db, staff.clubId, id, now) : undefined;
  if (product === undefined) {
    notFound();
  }
  const club = await getSalesSettings(db, staff.clubId);
  const dictionary = getAdminDictionary();
  const { sales } = dictionary;
  const text = sales.plans.detail;
  const tabs = TABS.filter((tab) => tab !== "preview" || product.kind === "membership");
  const tab: Tab = tabs.find((candidate) => candidate === query.tab) ?? "details";
  const view = { product, dictionary, role: staff.role };
  return (
    <>
      <PageHeader
        title={product.name.ar}
        description={product.tier?.ar}
        badge={<ProductStatusBadge status={product.status} statuses={sales.statuses} />}
      >
        <StatusActions {...view} />
      </PageHeader>
      <Notice text={noticeText(query.done, dictionary)} />
      <Tabs
        label={text.tabsLabel}
        current={tab}
        tabs={tabs.map((item) => ({
          id: item,
          label: text.tabs[item],
          href: item === "details" ? planPath(product.id) : `${planPath(product.id)}?tab=${item}`,
        }))}
      />
      {tab === "details" ? <DetailsTab {...view} timezone={club.timezone} /> : null}
      {tab === "pricing" ? (
        <PricingTab {...view} timezone={club.timezone} vatRateBps={club.vatRateBps} now={now} />
      ) : null}
      {tab === "preview" ? (
        <PlanPreviewCard
          product={product}
          published={await listClubMembershipPlans(db, staff.clubId, now)}
          text={sales.plans}
        />
      ) : null}
    </>
  );
}
