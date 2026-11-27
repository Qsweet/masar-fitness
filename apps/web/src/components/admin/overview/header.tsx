import Link from "next/link";
import type { ReactNode } from "react";
import { RANGE_PRESETS, type DateRange, type RangePreset } from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { AdminIcon } from "../admin-icon";
import { DateField } from "../ui/fields";
import { buttonClass } from "../ui/kit";
import styles from "./overview.module.css";

type OverviewText = AdminDictionary["overview"];

/** رابط فترة مضبوطة: الافتراضي (30 يومًا) بلا معامل، فرابط «نظرة عامة» العادي هو الافتراضي. */
export function presetHref(preset: RangePreset): string {
  return preset === "30d" ? ADMIN_ROUTES.home : `${ADMIN_ROUTES.home}?range=${preset}`;
}

/** نص الفترة كما تُوصف في السطر الشارح: «آخر 30 يومًا»، أو «من … إلى …» للمدى المخصص. */
export function rangeDescription(
  range: DateRange,
  text: OverviewText["range"],
  days: { readonly from: string; readonly to: string },
): string {
  return range.preset === "custom" ? fill(text.describe.custom, days) : text.describe[range.preset];
}

interface RangeControlProps {
  readonly range: DateRange;
  readonly text: OverviewText["range"];
  /** وصف المدى المخصص على زره حين يكون هو الحالي. */
  readonly customLabel: string;
  /** اليوم بتقويم النادي: آخر يوم يقبله الحقلان. */
  readonly today: string;
}

/**
 * محدِّد الفترة (§5.1): مقطع بأربعة روابط حالُها في الرابط (`aria-current`)، ومدى مخصص بنموذج GET
 * بحقلي تاريخ داخل ‎<details>‎. يعمل كله بلا JavaScript ويُشارك رابطه.
 */
export function RangeControl({ range, text, customLabel, today }: RangeControlProps) {
  const custom = range.preset === "custom";
  return (
    <div className={styles.range}>
      <nav aria-label={text.label} className={styles.segmented}>
        {RANGE_PRESETS.map((preset) => (
          <Link
            key={preset}
            href={presetHref(preset)}
            prefetch={false}
            className={styles.segment}
            aria-current={range.preset === preset ? "true" : undefined}
          >
            {text.presets[preset]}
          </Link>
        ))}
      </nav>
      <details className={styles.custom} data-admin-menu="">
        <summary className={styles.customButton} data-current={custom ? "" : undefined}>
          <AdminIcon name="calendar" size={16} />
          {custom ? customLabel : text.custom}
        </summary>
        <form method="get" action={ADMIN_ROUTES.home} className={styles.customPanel}>
          <DateField
            id="range-from"
            name="from"
            label={text.from}
            defaultValue={range.from}
            max={today}
            required
          />
          <DateField
            id="range-to"
            name="to"
            label={text.to}
            defaultValue={range.to}
            max={today}
            required
          />
          <button type="submit" className={buttonClass({ variant: "primary", block: true })}>
            {text.apply}
          </button>
        </form>
      </details>
    </div>
  );
}

interface OverviewHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly lead: string;
  readonly children: ReactNode;
}

/** رأس «نظرة عامة»: التاريخ بتقويم النادي، والتحية، وما بقي أو وصف الفترة، ومحدِّد الفترة. */
export function OverviewHeader({ eyebrow, title, lead, children }: OverviewHeaderProps) {
  return (
    <header className={styles.head}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.greeting}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
      </div>
      {children}
    </header>
  );
}
