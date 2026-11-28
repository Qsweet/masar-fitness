import { countCatalogProducts, listCatalogProducts, listClubMembershipPlans } from "@masar/db";
import { hasPermission, isProductAdminKind, PRODUCT_KINDS, type ProductKind } from "@masar/domain";
import type { Metadata } from "next";
import { PlansTable } from "@/components/admin/sales/plans-table";
import { TableCard } from "@/components/admin/ui/data-table";
import { ButtonLink, EmptyState, PageHeader, Tabs, uiStyles } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatNumber } from "@/i18n/format";
import { requireStaff } from "@/server/admin/guard";
import { bestValueSlug } from "@/server/admin/sales/catalog-view";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.plans.title };
}

/** الاشتراكات والإضافات دائمًا؛ والأنواع التي لا تُنشأ من اللوحة تظهر تبويبًا حين يوجد منها منتج. */
function visibleKinds(counts: Readonly<Record<ProductKind, number>>): ProductKind[] {
  return PRODUCT_KINDS.filter((kind) => isProductAdminKind(kind) || counts[kind] > 0).sort(
    (a, b) => Number(isProductAdminKind(b)) - Number(isProductAdminKind(a)),
  );
}

function kindHref(kind: ProductKind): string {
  return kind === "membership" ? ADMIN_ROUTES.plans : `${ADMIN_ROUTES.plans}?kind=${kind}`;
}

/**
 * قائمة الكتالوج بكل حالاته (المسودة والمنشور والمؤرشف): السعر الساري، وهل يُباع الآن بالقاعدة نفسها
 * التي تطبقها السلة، وأي باقة تحمل «الأكثر قيمة» في الموقع (محسوبة، للقراءة).
 */
interface KindTabsProps {
  readonly kinds: readonly ProductKind[];
  readonly current: ProductKind;
  readonly counts: Readonly<Record<ProductKind, number>>;
  readonly text: AdminDictionary["sales"]["plans"];
}

/** تبويب لكل نوع ظاهر بعدد منتجاته. */
function KindTabs({ kinds, current, counts, text }: KindTabsProps) {
  return (
    <Tabs
      label={text.tabsLabel}
      current={current}
      tabs={kinds.map((id) => ({
        id,
        label: text.tabs[id],
        href: kindHref(id),
        count: formatNumber(counts[id]),
      }))}
    />
  );
}

export default async function PlansPage(props: PageProps<"/admin/sales/plans">) {
  const { staff } = await requireStaff("catalog.read");
  const query = await props.searchParams;
  const db = getDb();
  const now = new Date();
  const counts = await countCatalogProducts(db, staff.clubId);
  const kinds = visibleKinds(counts);
  const kind = kinds.find((candidate) => candidate === query.kind) ?? "membership";
  const [rows, published] = await Promise.all([
    listCatalogProducts(db, staff.clubId, kind, now),
    listClubMembershipPlans(db, staff.clubId, now),
  ]);
  const { sales } = getAdminDictionary();
  const text = sales.plans;
  const creatable = isProductAdminKind(kind) ? kind : undefined;
  const canWrite = hasPermission(staff.role, "catalog.write");
  const empty = creatable === undefined ? text.empty.other : text.empty[creatable];
  const add =
    creatable !== undefined && canWrite ? (
      <ButtonLink href={`${ADMIN_ROUTES.plansNew}?kind=${creatable}`} variant="primary">
        {text.add[creatable]}
      </ButtonLink>
    ) : null;
  return (
    <>
      <PageHeader title={text.title} description={text.lead}>
        {add}
      </PageHeader>
      <KindTabs kinds={kinds} current={kind} counts={counts} text={text} />
      <TableCard>
        {rows.length === 0 ? (
          <EmptyState icon="plans" title={empty.title} description={empty.lead}>
            {add}
          </EmptyState>
        ) : (
          <PlansTable
            rows={rows}
            sales={sales}
            bestSlug={bestValueSlug(published)}
            caption={text.tabs[kind]}
          />
        )}
      </TableCard>
      <p className={uiStyles.note}>
        {creatable === undefined
          ? text.readOnlyKind
          : kind === "membership"
            ? text.bestValueNote
            : null}
      </p>
    </>
  );
}
