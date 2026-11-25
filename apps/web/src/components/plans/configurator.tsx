"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import { StickyReveal } from "@/components/ui/sticky-reveal";
import type { Dictionary } from "@/i18n/dictionaries";
import { PlanOption } from "./plan-option";
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
  /** روابط ثانوية تحت مربعات المدة (المقارنة والحاسبة). */
  readonly more?: ReactNode;
}

/** نص زر الشراء: «اشترِ الآن» إلى صفحة البيانات، أو واتساب والشراء الإلكتروني مغلق. */
function purchaseLabel(plan: PlanView, planLabels: Dictionary["plan"]): string {
  return plan.purchase.external ? planLabels.buyWhatsapp : planLabels.buyOnline;
}

/**
 * ما يشمله الاشتراك في الملخص: سطر واحد حين تتطابق مزايا كل الاشتراكات المعروضة (محسوب في plan-view)،
 * وإلا قائمة مزايا الاشتراك المختار.
 */
function Includes({
  plan,
  labels,
}: Pick<ConfiguratorProps, "labels"> & { readonly plan: PlanView }) {
  if (plan.benefits.length === 0) {
    return null;
  }
  if (plan.benefitsShared) {
    return <p className={styles.includesAll}>{labels.includesAll}</p>;
  }
  return (
    <>
      <p className={styles.summaryLabel}>{labels.includes}</p>
      <ul className={styles.includes}>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
    </>
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
      <Includes plan={plan} labels={labels} />
      <ButtonLink
        href={plan.purchase.href}
        external={plan.purchase.external}
        variant="yellow"
        block
      >
        {purchaseLabel(plan, planLabels)}
      </ButtonLink>
      {plan.purchase.external ? <p className={styles.buyNote}>{planLabels.buyNote}</p> : null}
      {plan.purchase.external ? null : (
        <a href={plan.whatsappHref} rel="noopener noreferrer" className={styles.details}>
          {planLabels.whatsappAlternative}
        </a>
      )}
      {plan.slug === currentSlug ? null : (
        <a href={plan.href} className={styles.details}>
          {labels.details}: {plan.name}
        </a>
      )}
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
        <Price
          parts={plan.price}
          className={styles.stickyPrice}
          unitClassName={styles.stickyUnit}
        />
      </p>
      {plan.purchase.external ? (
        <a href={plan.purchase.href} rel="noopener noreferrer">
          {purchaseLabel(plan, planLabels)}
        </a>
      ) : (
        <Link href={plan.purchase.href}>{purchaseLabel(plan, planLabels)}</Link>
      )}
    </StickyReveal>
  );
}

/**
 * محدِّد المدة: تختار المدة فيتحدث الملخص فورًا. الاختيار أزرار راديو حقيقية (لوحة المفاتيح
 * وقارئ الشاشة يعملان)، والسعر والنصوص محسوبة على الخادم؛ هنا اختيار وعرض فقط.
 */
export function Configurator(props: ConfiguratorProps) {
  const { plans, initialSlug, labels, more } = props;
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
          <PlanOption
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
      {more === undefined ? null : <div className={styles.more}>{more}</div>}
      <Summary plan={selected} {...props} />
      <StickyBar plan={selected} {...props} />
    </div>
  );
}
