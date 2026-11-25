import { MAX_VISITS_PER_WEEK, MIN_VISITS_PER_WEEK } from "@masar/domain";
import Link from "next/link";
import { buttonClass, ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import { ROUTES } from "@/config/routes";
import { countText } from "@/i18n/count";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import type { CostRow } from "./cost-per-visit-view";
import styles from "./cost-per-visit.module.css";

interface Props {
  readonly visits: number;
  readonly rows: readonly CostRow[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

const VISIT_OPTIONS = Array.from(
  { length: MAX_VISITS_PER_WEEK - MIN_VISITS_PER_WEEK + 1 },
  (_, index) => MIN_VISITS_PER_WEEK + index,
);

/** نموذج GET حقيقي: يعمل بلا JavaScript، والنتيجة برابط قابل للمشاركة (‎?visits=3‎). */
function VisitsForm({ visits, locale, dictionary }: Omit<Props, "rows">) {
  const text = dictionary.tools.costPerVisit;
  return (
    <form method="get" action={localizedPath(locale, ROUTES.costPerVisit)} className={styles.form}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{text.legend}</legend>
        <div className={styles.options}>
          {VISIT_OPTIONS.map((option) => (
            <label key={option} className={styles.option}>
              <input type="radio" name="visits" value={option} defaultChecked={option === visits} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className={buttonClass("ink")}>
        {text.submit}
      </button>
    </form>
  );
}

function ResultRow({
  row,
  dictionary,
}: {
  readonly row: CostRow;
  readonly dictionary: Dictionary;
}) {
  const text = dictionary.tools.costPerVisit;
  return (
    <li className={cx(styles.row, row.isBestValue && styles.best)}>
      <div>
        <Link href={row.href} className={styles.planName}>
          {row.name}
        </Link>
        {row.isBestValue ? (
          <span className={styles.badge}>{dictionary.plans.bestValue}</span>
        ) : null}
        <p className={styles.small}>{row.durationText}</p>
      </div>
      <dl className={styles.figures}>
        <div>
          <dt>{text.perVisit}</dt>
          <dd>
            <Price parts={row.perVisit} className={styles.perVisit} unitClassName={styles.unit} />
          </dd>
        </div>
        <div>
          <dt>{text.total}</dt>
          <dd>
            <Price parts={row.total} />
          </dd>
        </div>
      </dl>
    </li>
  );
}

/** الحاسبة كاملة على الخادم: النموذج ثم النتيجة لكل اشتراك معروض الآن، ثم بيان التقريب. */
export function CostPerVisit({ visits, rows, locale, dictionary }: Props) {
  const text = dictionary.tools.costPerVisit;
  return (
    <div className={cx("container", styles.tool)}>
      <VisitsForm visits={visits} locale={locale} dictionary={dictionary} />
      <section aria-labelledby="result-title" className={styles.result}>
        <h2 id="result-title" className="title-block">
          {fill(text.resultTitle, { times: countText(visits, text.times) })}
        </h2>
        {rows.length === 0 ? (
          <p>{dictionary.plans.emptyTitle}</p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <ResultRow key={row.slug} row={row} dictionary={dictionary} />
            ))}
          </ul>
        )}
        <p className={cx("muted", styles.note)}>{text.approximate}</p>
        <ButtonLink href={localizedPath(locale, ROUTES.memberships)}>
          {dictionary.plans.compare}
        </ButtonLink>
      </section>
    </div>
  );
}
