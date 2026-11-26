import type { CatalogProductDetail } from "@masar/db";
import Link from "next/link";
import { planPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { formatDay } from "@/i18n/admin/format";
import { formatNumber } from "@/i18n/format";
import { savePlanLinksAction } from "@/server/admin/actions/sales-plans";
import { AdminForm } from "../admin-form";
import { CheckboxField, FieldGroup } from "../ui/fields";
import { Card, Facts, Ltr, uiStyles } from "../ui/kit";
import { ProductStatusBadge } from "./catalog-parts";
import styles from "./sales.module.css";

interface SectionProps {
  readonly product: CatalogProductDetail;
  readonly sales: AdminDictionary["sales"];
}

/** بيانات المنتج الثابتة والمحسوبة: النوع، المعرّف، الحالة، هل يُباع، الإنشاء، المبيعات. */
export function PlanFactsCard({ product, sales, timezone }: SectionProps & { timezone: string }) {
  const text = sales.plans;
  const labels = text.detail;
  return (
    <Card title={labels.factsTitle}>
      <Facts
        items={[
          [labels.kind, sales.statuses.itemKind[product.kind]],
          [labels.slug, <Ltr key="slug">{product.slug}</Ltr>],
          [
            labels.status,
            <ProductStatusBadge key="status" status={product.status} statuses={sales.statuses} />,
          ],
          [labels.sellable, product.sellable ? text.sellable : text.notSellable],
          [labels.created, formatDay(product.createdAt, timezone)],
          [labels.sold, formatNumber(product.soldItems)],
        ]}
      />
    </Card>
  );
}

/** الهوية قراءةً لمن لا يعدّل (المبيعات)، ولنوع لا يُعدَّل من اللوحة. */
export function PlanIdentityFacts({ product, sales }: SectionProps) {
  const labels = sales.plans.detail;
  const form = sales.plans.form;
  const or = (value: string | undefined): string =>
    value === undefined || value === "" ? labels.none : value;
  return (
    <Card title={labels.identityReadOnly}>
      <Facts
        items={[
          [form.nameAr, product.name.ar],
          [form.nameEn, <Ltr key="en">{product.name.en}</Ltr>],
          [form.summaryAr, or(product.summary.ar)],
          [form.summaryEn, <Ltr key="summary">{or(product.summary.en)}</Ltr>],
          [labels.tier, or(product.tier?.ar)],
          [labels.sortOrder, formatNumber(product.sortOrder)],
        ]}
      />
    </Card>
  );
}

function LinkList({ product, sales }: SectionProps) {
  const linked = product.links.filter((link) => link.linked);
  if (linked.length === 0) {
    return <p className={uiStyles.note}>{sales.plans.detail.linksEmpty}</p>;
  }
  return (
    <ul className={styles.benefitList}>
      {linked.map((link) => (
        <li key={link.id}>
          <Link href={planPath(link.id)} prefetch={false} className={styles.rowLink}>
            {link.name.ar}
          </Link>{" "}
          <span className={uiStyles.note}>{sales.statuses.product[link.status]}</span>
        </li>
      ))}
    </ul>
  );
}

interface LinksProps extends SectionProps {
  readonly canWrite: boolean;
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * روابط الإضافة بالباقات: خانات اختيار لمن يعدّل، وقائمة لمن يقرأ. للاشتراك: الإضافات المعروضة معه
 * قراءةً (تُضبط من صفحة الإضافة).
 */
export function PlanLinksCard({ product, sales, canWrite, errors }: LinksProps) {
  const labels = sales.plans.detail;
  if (product.kind !== "addon" && product.kind !== "membership") {
    return null;
  }
  const kind = product.kind;
  const editable = kind === "addon" && canWrite && product.links.length > 0;
  return (
    <Card title={labels.linksTitle[kind]} description={labels.linksLead[kind]}>
      {kind === "addon" && product.links.length === 0 ? (
        <p className={uiStyles.note}>{labels.noPlans}</p>
      ) : null}
      {editable ? (
        <AdminForm action={savePlanLinksAction} labels={{ submit: labels.saveLinks, errors }}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="lockToken" value={product.lockToken} />
          <FieldGroup legend={labels.linksTitle.addon}>
            <div className={uiStyles.checkList}>
              {product.links.map((link) => (
                <CheckboxField
                  key={link.id}
                  id={`link-${link.id}`}
                  name="membershipIds"
                  value={link.id}
                  defaultChecked={link.linked}
                  label={`${link.name.ar} (${sales.statuses.product[link.status]})`}
                />
              ))}
            </div>
          </FieldGroup>
        </AdminForm>
      ) : (
        <LinkList product={product} sales={sales} />
      )}
    </Card>
  );
}
