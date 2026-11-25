import {
  approximateMonthlyCost,
  sharedBenefits,
  totalMonths,
  type MembershipPlan,
} from "@masar/domain";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { formatList, formatMonths, moneyParts } from "@/i18n/format";
import { localizedPath, type Locale } from "@/i18n/locales";
import { durationText } from "./plan-view";
import styles from "./comparison-table.module.css";

interface ComparisonTableProps {
  readonly plans: readonly MembershipPlan[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

interface Row {
  readonly label: string;
  readonly cell: (plan: MembershipPlan) => ReactNode;
}

/** كل المزايا التي تظهر في أي باقة، بترتيب أول ظهور. */
function allBenefits(plans: readonly MembershipPlan[], locale: Locale): string[] {
  return [...new Set(plans.flatMap((plan) => plan.benefits.map((benefit) => benefit[locale])))];
}

function IncludedMark({
  included,
  dictionary,
}: {
  readonly included: boolean;
  readonly dictionary: Dictionary;
}) {
  return (
    <>
      <span aria-hidden="true">{included ? "✓" : "—"}</span>
      <span className="sr-only">
        {included ? dictionary.memberships.included : dictionary.memberships.notIncluded}
      </span>
    </>
  );
}

/** صفا السعر: الإجمالي وما يعادله شهريًا، في الجدول وفي صفوف الجوال. */
function priceRows({ locale, dictionary }: Omit<ComparisonTableProps, "plans">): Row[] {
  const labels = dictionary.memberships;
  return [
    {
      label: labels.rowPrice,
      cell: (plan) => <Price parts={moneyParts(plan.price, locale)} className={styles.price} />,
    },
    {
      label: labels.rowMonthly,
      cell: (plan) => <Price parts={moneyParts(approximateMonthlyCost(plan), locale)} />,
    },
  ];
}

/** الجدول يفصّل المدة في ثلاثة صفوف (المدفوعة، المجانية، الإجمالية) ثم السعر. */
function tableRows(props: Omit<ComparisonTableProps, "plans">): Row[] {
  const { locale, dictionary } = props;
  const labels = dictionary.memberships;
  return [
    { label: labels.rowDuration, cell: (plan) => formatMonths(plan.paidMonths, locale) },
    {
      label: labels.rowBonus,
      cell: (plan) => (plan.bonusMonths > 0 ? formatMonths(plan.bonusMonths, locale) : labels.none),
    },
    { label: labels.rowTotalDuration, cell: (plan) => formatMonths(totalMonths(plan), locale) },
    ...priceRows(props),
  ];
}

/** صفوف الجوال أقصر: المدة الكاملة في سطر واحد («14 شهرًا، منها شهران مجانًا») ثم السعر. */
function listRows(props: Omit<ComparisonTableProps, "plans">): Row[] {
  const { locale, dictionary } = props;
  return [
    {
      label: dictionary.memberships.rowTotalDuration,
      cell: (plan) => durationText(plan, locale),
    },
    ...priceRows(props),
  ];
}

/** صفوف المزايا تظهر فقط حين تختلف الباقات فيها (sharedBenefits)؛ وإلا جملة واحدة تحت المقارنة. */
function benefitRows({ plans, locale, dictionary }: ComparisonTableProps): Row[] {
  if (sharedBenefits(plans) !== undefined) {
    return [];
  }
  return allBenefits(plans, locale).map((benefit) => ({
    label: benefit,
    cell: (plan) => (
      <IncludedMark
        included={plan.benefits.some((item) => item[locale] === benefit)}
        dictionary={dictionary}
      />
    ),
  }));
}

function ChooseButton({
  plan,
  locale,
  dictionary,
}: Omit<ComparisonTableProps, "plans"> & {
  readonly plan: MembershipPlan;
}) {
  return (
    <ButtonLink href={localizedPath(locale, `/memberships/${plan.slug}`)} block>
      {dictionary.plans.choose}
      <span className="sr-only">: {plan.name[locale]}</span>
    </ButtonLink>
  );
}

/** الجوال: صف لكل باقة (الاسم، المدة، الإجمالي، الشهري، زر بعرض كامل) بدل جدول يتحرك أفقيًا. */
function PlanRows(props: ComparisonTableProps) {
  const { plans, locale, dictionary } = props;
  const rows = listRows(props);
  return (
    <ul className={styles.list}>
      {plans.map((plan) => (
        <li key={plan.slug} className={styles.item}>
          <p className={styles.itemName}>{plan.name[locale]}</p>
          <dl className={styles.facts}>
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.cell(plan)}</dd>
              </div>
            ))}
          </dl>
          <ChooseButton plan={plan} locale={locale} dictionary={dictionary} />
        </li>
      ))}
    </ul>
  );
}

/** الشاشة الواسعة: جدول حقيقي، صف لكل صفة وعمود لكل باقة، وزر اختيار في آخره. */
function PlanTable(props: ComparisonTableProps) {
  const { plans, locale, dictionary } = props;
  const rows = [...tableRows(props), ...benefitRows(props)];
  return (
    <table className={styles.table}>
      <caption className="sr-only">{dictionary.memberships.compareCaption}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.corner}>
            {dictionary.memberships.rowPlan}
          </th>
          {plans.map((plan) => (
            <th key={plan.slug} scope="col" className={styles.planName}>
              {plan.name[locale]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${String(index)}-${row.label}`}>
            <th scope="row">{row.label}</th>
            {plans.map((plan) => (
              <td key={plan.slug}>{row.cell(plan)}</td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td />
          {plans.map((plan) => (
            <td key={plan.slug}>
              <ChooseButton plan={plan} locale={locale} dictionary={dictionary} />
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * مقارنة الاشتراكات: صفوف مكدّسة على الجوال، وجدول على الشاشة الواسعة (يُعرض أحدهما بـCSS).
 * حين تشمل كل باقة كل المزايا تحل جملة واحدة محل صفوف العلامات المتطابقة.
 */
export function ComparisonTable(props: ComparisonTableProps) {
  const { plans, locale, dictionary } = props;
  const shared = sharedBenefits(plans);
  return (
    <div className={styles.comparison}>
      <PlanRows {...props} />
      <PlanTable {...props} />
      {shared === undefined ? null : (
        <p className={styles.allIncluded}>
          {fill(dictionary.memberships.allIncluded, {
            benefits: formatList(
              shared.map((benefit) => benefit[locale]),
              locale,
            ),
          })}
        </p>
      )}
    </div>
  );
}
