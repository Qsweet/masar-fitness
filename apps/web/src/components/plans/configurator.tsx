"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
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
  /** روابط ثانوية تحت الملخص (المقارنة والحاسبة). */
  readonly more?: ReactNode;
}

/** نص زر الشراء: «اشترِ الآن» إلى صفحة البيانات، أو واتساب والشراء الإلكتروني مغلق. */
function purchaseLabel(plan: PlanView, planLabels: Dictionary["plan"]): string {
  return plan.purchase.external ? planLabels.buyWhatsapp : planLabels.buyOnline;
}

/** المزايا حين تختلف بين الاشتراكات (حين تتطابق يكفي سطر «يشمل جميع مرافق النادي» في البطاقة). */
function Includes({
  plan,
  labels,
}: Pick<ConfiguratorProps, "labels"> & { readonly plan: PlanView }) {
  if (plan.benefits.length === 0 || plan.benefitsShared) {
    return plan.benefitsShared ? <p className={styles.includesAll}>{labels.includesAll}</p> : null;
  }
  return (
    <div className={styles.includes}>
      <p className={styles.label}>{labels.includes}</p>
      <ul>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
    </div>
  );
}

function Secondary({ plan, currentSlug, labels, planLabels }: SummaryProps) {
  return (
    <div className={styles.secondary}>
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

type SummaryProps = Pick<ConfiguratorProps, "currentSlug" | "labels" | "planLabels"> & {
  readonly plan: PlanView;
};

/** ملخص الاختيار الحي تحت البطاقات: الاسم والمدة، ثم الإجمالي وزر الشراء. */
function Summary(props: SummaryProps) {
  const { plan, labels, planLabels } = props;
  return (
    <div className={styles.summary} aria-live="polite">
      <div className={styles.summaryText}>
        <p className={styles.summaryName}>{plan.name}</p>
        <p className={styles.muted}>{plan.durationText}</p>
        {plan.monthlyText === undefined ? null : <p className={styles.muted}>{plan.monthlyText}</p>}
        <Includes plan={plan} labels={labels} />
      </div>
      <div className={styles.summaryBuy}>
        <p className={styles.label}>{labels.total}</p>
        <p className={styles.summaryPrice}>
          <Price parts={plan.price} unitClassName={styles.summaryUnit} />
        </p>
        <p className={styles.muted}>{labels.vatIncluded}</p>
        <ButtonLink href={plan.purchase.href} external={plan.purchase.external} block>
          {purchaseLabel(plan, planLabels)}
          <Icon name="arrow" />
        </ButtonLink>
      </div>
      <Secondary {...props} />
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
 * محدِّد المدة: بطاقات أسعار هي أزرار راديو حقيقية، والملخص تحتها يتحدث فورًا مع الاختيار.
 * السعر والنصوص محسوبة على الخادم (plan-view)؛ هنا اختيار وعرض فقط.
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
      <fieldset className={styles.options} data-count={plans.length}>
        <legend className="sr-only">{labels.legend}</legend>
        {plans.map((plan) => (
          <PlanOption
            key={plan.slug}
            plan={plan}
            selected={plan.slug === selected.slug}
            labels={labels}
            onSelect={() => {
              setSlug(plan.slug);
            }}
          />
        ))}
      </fieldset>
      <Summary plan={selected} {...props} />
      {more === undefined ? null : <div className={styles.more}>{more}</div>}
      <StickyBar plan={selected} {...props} />
    </div>
  );
}
