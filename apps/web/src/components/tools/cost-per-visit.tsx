import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import { ROUTES } from "@/config/routes";
import { countText } from "@/i18n/count";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import type { CostRow } from "./cost-per-visit-view";
import styles from "./cost-per-visit.module.css";
import { VisitsForm } from "./visits-form";

interface Props {
  readonly visits: number;
  readonly rows: readonly CostRow[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
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
      <VisitsForm
        visits={visits}
        action={localizedPath(locale, ROUTES.costPerVisit)}
        legend={text.legend}
        submit={text.submit}
      />
      <section aria-labelledby="result-title" className={styles.result}>
        <h2 id="result-title" className="title-block" aria-live="polite">
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
