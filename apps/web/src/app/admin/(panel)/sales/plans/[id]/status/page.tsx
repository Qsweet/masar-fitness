import {
  countOtherSellableMemberships,
  getCatalogProduct,
  type CatalogProductDetail,
} from "@masar/db";
import {
  decideProductStatus,
  isProductAdminKind,
  isProductStatusAction,
  publishBlockers,
  type ProductStatusAction,
  type PublishReadiness,
} from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import { CheckboxField } from "@/components/admin/ui/fields";
import { Alert, ButtonLink, Card, PageHeader, uiStyles } from "@/components/admin/ui/kit";
import { planPath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { setPlanStatusAction } from "@/server/admin/actions/sales-plans";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.breadcrumbs.planStatus };
}

type StatusText = AdminDictionary["sales"]["plans"]["status"];

function readiness(product: CatalogProductDetail): PublishReadiness {
  return publishBlockers({
    kind: product.kind,
    name: product.name,
    summary: product.summary,
    currentVersion: product.currentVersion,
    linkedPlans: product.links.filter((link) => link.linked).length,
  });
}

const NO_ISSUES: PublishReadiness = { blockers: [], warnings: [] };

interface ConfirmProps {
  readonly product: CatalogProductDetail;
  readonly action: ProductStatusAction;
  /** بعد هذا الإجراء لا يبقى اشتراك يُباع. */
  readonly last: boolean;
  readonly warnings: PublishReadiness["warnings"];
  readonly text: StatusText;
  readonly errors: AdminDictionary["errors"];
}

function ConfirmCard({ product, action, last, warnings, text, errors }: ConfirmProps) {
  return (
    <Card title={text.consequencesTitle} narrow>
      <ul className={uiStyles.consequences}>
        {text.consequences[action].map((line) => (
          <li key={line}>{line}</li>
        ))}
        {action !== "publish" && product.pendingOrders > 0 ? (
          <li>{fill(text.pending, { count: formatNumber(product.pendingOrders) })}</li>
        ) : null}
      </ul>
      {warnings.map((warning) => (
        <Alert key={warning} tone="warning">
          {text.warnings[warning]}
        </Alert>
      ))}
      {last ? (
        <Alert tone="danger">
          <span>
            <strong>{text.lastTitle}.</strong> {text.last}
          </span>
        </Alert>
      ) : null}
      <AdminForm
        action={setPlanStatusAction}
        labels={{ submit: text.submit[action], errors }}
        variant={action === "publish" ? "primary" : "danger"}
      >
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="lockToken" value={product.lockToken} />
        <input type="hidden" name="action" value={action} />
        {last ? (
          <CheckboxField
            id="confirm-last"
            name="confirmLast"
            value="yes"
            label={text.confirmLast}
            required
          />
        ) : null}
      </AdminForm>
    </Card>
  );
}

interface StatusView {
  readonly product: CatalogProductDetail;
  readonly action: ProductStatusAction;
  /** الإجراء ما زال يصح للمنتج في حالته الآن. */
  readonly available: boolean;
  readonly last: boolean;
}

/** المنتج والإجراء المطلوب وما يُحسب لتأكيده؛ undefined لمعرّف أو إجراء مجهول أو نوع لا يُدار. */
async function loadView(clubId: string, id: string, to: unknown): Promise<StatusView | undefined> {
  const db = getDb();
  const now = new Date();
  const product = isUuid(id) ? await getCatalogProduct(db, clubId, id, now) : undefined;
  if (product === undefined || !isProductStatusAction(to) || !isProductAdminKind(product.kind)) {
    return undefined;
  }
  const decision = decideProductStatus(product.status, to);
  const hides = to !== "publish" && product.kind === "membership" && product.sellable;
  const others = hides ? await countOtherSellableMemberships(db, clubId, product.id, now) : 1;
  return {
    product,
    action: to,
    available: decision.ok && !decision.value.replay,
    last: others === 0,
  };
}

/**
 * تأكيد نشر منتج أو إخفائه أو أرشفته: العواقب مكتوبة قبل الزر، وموانع النشر تُعرض بدل الزر، وإخفاء
 * آخر باقة تُباع يحتاج خانة تأكيد صريحة. صفحة من الخادم (بلا `confirm()`) فتعمل بلا JavaScript.
 */
export default async function PlanStatusPage(props: PageProps<"/admin/sales/plans/[id]/status">) {
  const { staff } = await requireStaff("catalog.publish");
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const view = await loadView(staff.clubId, id, query.to);
  if (view === undefined) {
    notFound();
  }
  const { product, action, available, last } = view;
  const { sales, errors } = getAdminDictionary();
  const text = sales.plans.status;
  const { blockers, warnings } = action === "publish" ? readiness(product) : NO_ISSUES;
  return (
    <>
      <PageHeader
        title={text.title[action]}
        description={available ? fill(text.lead[action], { name: product.name.ar }) : undefined}
      >
        <ButtonLink href={planPath(product.id)} variant="ghost">
          {text.back}
        </ButtonLink>
      </PageHeader>
      {available ? null : <Alert tone="warning">{text.unavailable}</Alert>}
      {available && blockers.length > 0 ? (
        <Card title={text.blockedTitle} narrow>
          <ul className={uiStyles.consequences}>
            {blockers.map((blocker) => (
              <li key={blocker}>{text.blockers[blocker]}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      {available && blockers.length === 0 ? (
        <ConfirmCard
          product={product}
          action={action}
          last={last}
          warnings={warnings}
          text={text}
          errors={errors}
        />
      ) : null}
    </>
  );
}
