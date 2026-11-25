"use client";

import { useState } from "react";
import type { LabPlan } from "../data";
import { cx } from "../cx";
import { fill } from "../text";
import { C3 } from "./copy";
import styles from "./c3.module.css";

interface ConfiguratorProps {
  readonly plans: readonly LabPlan[];
  readonly initialSlug: string;
}

function durationText(plan: LabPlan): string {
  if (plan.bonusLabel === undefined) {
    return fill(C3.buy.durationLine, { total: plan.totalLabel });
  }
  return fill(C3.buy.durationBonus, {
    total: plan.totalLabel,
    paid: plan.durationLabel,
    bonus: plan.bonusLabel,
  });
}

function Option({
  plan,
  selected,
  onSelect,
}: {
  readonly plan: LabPlan;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <label className={cx(styles.option, selected && styles.optionSelected)}>
      <input
        type="radio"
        name="c3-plan"
        value={plan.slug}
        checked={selected}
        onChange={onSelect}
        className={styles.optionInput}
      />
      <span className={styles.optionDuration}>{plan.durationLabel}</span>
      {plan.bonusLabel === undefined ? null : (
        <span className={styles.optionBonus}>{fill(C3.buy.bonus, { bonus: plan.bonusLabel })}</span>
      )}
      <span className={styles.optionPrice}>
        <bdi>{plan.price.amount}</bdi> {plan.price.unit}
      </span>
      {plan.isBestValue ? <span className={styles.optionFlag}>{C3.buy.bestValue}</span> : null}
    </label>
  );
}

function Summary({ plan }: { readonly plan: LabPlan }) {
  return (
    <div className={styles.summary} aria-live="polite">
      <p className={styles.summaryName}>{plan.name}</p>
      <p className={styles.summaryLabel}>{C3.buy.total}</p>
      <p className={styles.summaryPrice}>
        <bdi>{plan.price.amount}</bdi> <span>{plan.price.unit}</span>
      </p>
      <p className={styles.summaryNote}>{C3.buy.totalNote}</p>
      <dl className={styles.summaryFacts}>
        <div>
          <dt>{durationText(plan)}</dt>
          {plan.monthly === undefined ? null : (
            <dd>
              {fill(C3.buy.monthly, { amount: plan.monthly.amount, unit: plan.monthly.unit })}
            </dd>
          )}
        </div>
      </dl>
      <p className={styles.summaryLabel}>{C3.buy.includes}</p>
      <ul className={styles.summaryIncludes}>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <a href={plan.href} className={styles.buttonPrimary}>
        {fill(C3.buy.cta, { name: plan.name })}
      </a>
      <p className={styles.summaryNote}>{C3.buy.pay}</p>
    </div>
  );
}

/**
 * صفحة شراء كمتجر منتج: تختار المدة فيتحدث الملخص فورًا. الاختيار أزرار راديو حقيقية
 * (لوحة المفاتيح وقارئ الشاشة يعملان)، والشراء رابط لصفحة الباقة على الخادم: السعر لا يُحسب هنا.
 */
export function Configurator({ plans, initialSlug }: ConfiguratorProps) {
  const [slug, setSlug] = useState(initialSlug);
  const selected = plans.find((plan) => plan.slug === slug) ?? plans[0];
  if (selected === undefined) {
    return <p>{C3.buy.empty}</p>;
  }
  return (
    <div className={styles.configurator}>
      <fieldset className={styles.options}>
        <legend className={styles.summaryLabel}>{C3.buy.durationLegend}</legend>
        {plans.map((plan) => (
          <Option
            key={plan.slug}
            plan={plan}
            selected={plan.slug === selected.slug}
            onSelect={() => {
              setSlug(plan.slug);
            }}
          />
        ))}
      </fieldset>
      <Summary plan={selected} />
    </div>
  );
}
