import { monthlyEquivalent, totalMonths, type MembershipPlan } from "@masar/domain";
import Link from "next/link";
import type { ReactNode } from "react";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatMonths, moneyParts, roundedMoneyParts } from "@/i18n/format";
import { localizedPath, type Locale } from "@/i18n/locales";

interface ComparisonTableProps {
  readonly plans: readonly MembershipPlan[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

interface Row {
  readonly label: string;
  readonly cell: (plan: MembershipPlan) => ReactNode;
}

const CELL = "rule border-t px-4 py-4 text-start align-top";

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
      cell: (plan) => <Price parts={moneyParts(plan.price, locale)} className="font-strong" />,
    },
    {
      label: labels.rowMonthly,
      cell: (plan) => <Price parts={roundedMoneyParts(monthlyEquivalent(plan), locale)} />,
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
        <th scope="col" className="px-4 py-4 text-start text-small font-medium">
          {dictionary.memberships.rowPlan}
        </th>
        {plans.map((plan) => (
          <th
            key={plan.slug}
            scope="col"
            className="px-4 py-4 text-start text-heading font-strong whitespace-nowrap"
          >
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
        <td className={CELL} />
        {plans.map((plan) => (
          <td key={plan.slug} className={CELL}>
            <Link
              href={localizedPath(locale, `/memberships/${plan.slug}`)}
              className="font-strong underline underline-offset-4"
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
      className="rule relative overflow-x-auto border-b"
    >
      <table className="w-full min-w-[40rem] border-collapse">
        <caption className="sr-only">{dictionary.memberships.compareCaption}</caption>
        <TableHead {...props} />
        <tbody>
          {buildRows(props).map((row) => (
            <tr key={row.label}>
              <th scope="row" className={`${CELL} text-muted font-medium`}>
                {row.label}
              </th>
              {plans.map((plan) => (
                <td key={plan.slug} className={CELL}>
                  {row.cell(plan)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <TableFoot {...props} />
      </table>
    </div>
  );
}
