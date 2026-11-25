import { approximateMonthlyCost, totalMonths, type MembershipPlan } from "@masar/domain";
import Link from "next/link";
import type { ReactNode } from "react";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatMonths, moneyParts } from "@/i18n/format";
import { localizedPath, type Locale } from "@/i18n/locales";
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

function buildRows({ plans, locale, dictionary }: ComparisonTableProps): Row[] {
  const labels = dictionary.memberships;
  const facts: Row[] = [
    { label: labels.rowDuration, cell: (plan) => formatMonths(plan.paidMonths, locale) },
    {
      label: labels.rowBonus,
      cell: (plan) => (plan.bonusMonths > 0 ? formatMonths(plan.bonusMonths, locale) : labels.none),
    },
    { label: labels.rowTotalDuration, cell: (plan) => formatMonths(totalMonths(plan), locale) },
    {
      label: labels.rowPrice,
      cell: (plan) => <Price parts={moneyParts(plan.price, locale)} className={styles.price} />,
    },
    {
      label: labels.rowMonthly,
      cell: (plan) => <Price parts={moneyParts(approximateMonthlyCost(plan), locale)} />,
    },
  ];
  const benefits: Row[] = allBenefits(plans, locale).map((benefit) => ({
    label: benefit,
    cell: (plan) => (
      <IncludedMark
        included={plan.benefits.some((item) => item[locale] === benefit)}
        dictionary={dictionary}
      />
    ),
  }));
  return [...facts, ...benefits];
}

function TableHead({ plans, locale, dictionary }: ComparisonTableProps) {
  return (
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
  );
}

/** صف أخير بزر اختيار لكل باقة: القارئ ينهي المقارنة حيث يستطيع أن يتصرف. */
function TableFoot({ plans, locale, dictionary }: ComparisonTableProps) {
  return (
    <tfoot>
      <tr>
        <td />
        {plans.map((plan) => (
          <td key={plan.slug}>
            <Link
              href={localizedPath(locale, `/memberships/${plan.slug}`)}
              className={styles.choose}
            >
              {dictionary.plans.choose}
              <span className="sr-only">: {plan.name[locale]}</span>
            </Link>
          </td>
        ))}
      </tr>
    </tfoot>
  );
}

/**
 * جدول مقارنة حقيقي (لا بطاقات): صف لكل صفة وعمود لكل باقة، ويتحرك أفقيًا على الشاشات الضيقة.
 * الحاوية `relative` لتحتوي النصوص المخفية بصريًا (sr-only)، وإلا خرجت من منطقة التمرير ووسّعت الصفحة.
 */
export function ComparisonTable(props: ComparisonTableProps) {
  const { plans, dictionary } = props;
  return (
    <div
      role="region"
      aria-label={dictionary.memberships.compareCaption}
      tabIndex={0}
      className={styles.scroller}
    >
      <table className={styles.table}>
        <caption className="sr-only">{dictionary.memberships.compareCaption}</caption>
        <TableHead {...props} />
        <tbody>
          {buildRows(props).map((row, index) => (
            <tr key={`${String(index)}-${row.label}`}>
              <th scope="row">{row.label}</th>
              {plans.map((plan) => (
                <td key={plan.slug}>{row.cell(plan)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <TableFoot {...props} />
      </table>
    </div>
  );
}
