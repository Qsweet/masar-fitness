"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import { StickyReveal } from "@/components/ui/sticky-reveal";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import type { PlanView } from "./plan-view";
import styles from "./configurator.module.css";

export interface ConfiguratorProps {
  readonly plans: readonly PlanView[];
  readonly initialSlug: string;
  /** اشتراك الصفحة الحالية: لا رابط «تفاصيل» يعود إليها. */
  readonly currentSlug?: string | undefined;
  /** شريط الشراء الثابت (جوال) يظهر بعد أن يغادر هذا العنصر الشاشة. */
  readonly revealAfterId: string;
  readonly labels: Dictionary["plans"];
  readonly planLabels: Dictionary["plan"];
}

interface OptionProps {
  readonly plan: PlanView;
  readonly selected: boolean;
  readonly bestValueLabel: string;
  readonly onSelect: () => void;
}

function Option({ plan, selected, bestValueLabel, onSelect }: OptionProps) {
  const { count, unit } = plan.duration;
  return (
    <label className={cx(styles.option, selected && styles.selected)}>
      <input
        type="radio"
        name="plan"
        value={plan.slug}
        checked={selected}
        onChange={onSelect}
        className={styles.input}
      />
      {plan.isBestValue ? <span className={styles.flag}>{bestValueLabel}</span> : null}
      <span className={styles.duration}>
        {count === undefined ? null : <span className={styles.count}>{count}</span>}
        <span className={cx(styles.unit, count === undefined && styles.unitAlone)}>{unit}</span>
      </span>
      {plan.bonusText === undefined ? null : <span className={styles.bonus}>{plan.bonusText}</span>}
      <Price parts={plan.price} className={styles.optionPrice} />
    </label>
  );
}

function Summary({
  plan,
  currentSlug,
  labels,
  planLabels,
}: Pick<ConfiguratorProps, "currentSlug" | "labels" | "planLabels"> & {
  readonly plan: PlanView;
}) {
  return (
    <div className={styles.summary} aria-live="polite">
      <p className={styles.summaryName}>{plan.name}</p>
      <p className={styles.summaryLabel}>{labels.total}</p>
      <p className={styles.summaryPrice}>
        <Price parts={plan.price} unitClassName={styles.summaryUnit} />
      </p>
      <p className={styles.summaryNote}>{labels.vatIncluded}</p>
      <div className={styles.summaryFacts}>
        <p>{plan.durationText}</p>
        {plan.monthlyText === undefined ? null : (
          <p className={styles.summaryNote}>{plan.monthlyText}</p>
        )}
      </div>
      <p className={styles.summaryLabel}>{labels.includes}</p>
      <ul className={styles.includes}>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <a href={plan.purchaseHref} rel="noopener noreferrer" className={buttonClass("yellow", true)}>
        {planLabels.buyWhatsapp}
      </a>
      {plan.slug === currentSlug ? null : (
        <a href={plan.href} className={styles.details}>
          {labels.details}: {plan.name}
        </a>
      )}
      <p className={styles.summaryNote}>{planLabels.buyNote}</p>
    </div>
  );
}

function StickyBar({
  plan,
  revealAfterId,
  planLabels,
}: Pick<ConfiguratorProps, "revealAfterId" | "planLabels"> & { readonly plan: PlanView }) {
  return (
    <StickyReveal afterId={revealAfterId} label={planLabels.stickyLabel} className={styles.sticky}>
      <p>
        <span className={styles.stickyName}>{plan.name}</span>
        <Price parts={plan.price} className={styles.stickyPrice} />
      </p>
      <a href={plan.purchaseHref} rel="noopener noreferrer">
        {planLabels.buyWhatsapp}
      </a>
    </StickyReveal>
  );
}

/**
 * محدِّد المدة: تختار المدة فيتحدث الملخص فورًا. الاختيار أزرار راديو حقيقية (لوحة المفاتيح
 * وقارئ الشاشة يعملان)، والسعر والنصوص محسوبة على الخادم؛ هنا اختيار وعرض فقط.
 */
export function Configurator(props: ConfiguratorProps) {
  const { plans, initialSlug, labels } = props;
  const [slug, setSlug] = useState(initialSlug);
  const selected = plans.find((plan) => plan.slug === slug) ?? plans[0];
  if (selected === undefined) {
    return null;
  }
  return (
    <div className={styles.configurator}>
      <fieldset className={styles.options}>
        <legend className={styles.legend}>{labels.legend}</legend>
        {plans.map((plan) => (
          <Option
            key={plan.slug}
            plan={plan}
            selected={plan.slug === selected.slug}
            bestValueLabel={labels.bestValue}
            onSelect={() => {
              setSlug(plan.slug);
            }}
          />
        ))}
      </fieldset>
      <Summary plan={selected} {...props} />
      <StickyBar plan={selected} {...props} />
    </div>
  );
}
