"use client";

import { useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import { StickyReveal } from "@/components/ui/sticky-reveal";
import type { Dictionary } from "@/i18n/dictionaries";
import { PlanOption } from "./plan-option";
import { PurchaseButton } from "./purchase-button";
import { centreBestValue, type PlanView } from "./plan-view";
import styles from "./configurator.module.css";

export interface ConfiguratorProps {
  readonly plans: readonly PlanView[];
  readonly initialSlug: string;
  /** شريط الشراء الثابت (جوال) يظهر بعد أن يغادر هذا العنصر الشاشة. */
  readonly revealAfterId: string;
  readonly labels: Dictionary["plans"];
  readonly planLabels: Dictionary["plan"];
  /** روابط ثانوية تحت الملخص (المقارنة والحاسبة). */
  readonly more?: ReactNode;
  /** زر واتساب العام في شريط الجوال (مكان زر المحادثة العائم على الهاتف) */
  readonly chat: { readonly href: string; readonly label: string };
}

/** الملخص الحي: شريط الجوال يختفي ما دام ظاهرًا، فلا يتكرر السعر والزر مرتين على الشاشة. */
const SUMMARY_ID = "plan-summary";

/** نص زر الشراء: «اشترِ الآن» إلى السلة، أو واتساب والشراء الإلكتروني مغلق. */
function purchaseLabel(plan: PlanView, planLabels: Dictionary["plan"]): string {
  return plan.purchase.kind === "whatsapp" ? planLabels.buyWhatsapp : planLabels.buyOnline;
}

function Secondary({ plan, labels, planLabels }: SummaryProps) {
  const viaWhatsapp = plan.purchase.kind === "whatsapp";
  return (
    <div className={styles.secondary}>
      {viaWhatsapp ? <p className={styles.buyNote}>{planLabels.buyNote}</p> : null}
      {viaWhatsapp ? null : (
        <a href={plan.whatsappHref} rel="noopener noreferrer" className={styles.details}>
          {planLabels.whatsappAlternative}
        </a>
      )}
      <a href={plan.href} className={styles.details}>
        {labels.details}: {plan.name}
      </a>
    </div>
  );
}

type SummaryProps = Pick<ConfiguratorProps, "labels" | "planLabels"> & {
  readonly plan: PlanView;
};

/**
 * ملخص الاختيار الحي تحت البطاقات، شريط واحد: الاسم والمدة، والإجمالي، وزر الشراء.
 * المزايا والشهري والتجميد في البطاقات نفسها، فلا تتكرر هنا.
 */
function Summary(props: SummaryProps) {
  const { plan, labels, planLabels } = props;
  return (
    <div id={SUMMARY_ID} className={styles.summary} aria-live="polite">
      <div className={styles.summaryText}>
        <p className={styles.summaryName}>{plan.name}</p>
        <p className={styles.muted}>{plan.durationText}</p>
      </div>
      <p className={styles.summaryPrice}>
        <span className={styles.label}>{labels.total}</span>
        <Price parts={plan.price} unitClassName={styles.summaryUnit} />
      </p>
      <PurchaseButton purchase={plan.purchase} className={buttonClass("primary")}>
        {purchaseLabel(plan, planLabels)}
        <Icon name="arrow" />
      </PurchaseButton>
      <Secondary {...props} />
    </div>
  );
}

function StickyBar({
  plan,
  revealAfterId,
  planLabels,
  chat,
}: Pick<ConfiguratorProps, "revealAfterId" | "planLabels" | "chat"> & {
  readonly plan: PlanView;
}) {
  return (
    <StickyReveal
      afterId={revealAfterId}
      hideWhileId={SUMMARY_ID}
      label={planLabels.stickyLabel}
      className={styles.sticky}
    >
      <p>
        <span className={styles.stickyName}>{plan.name}</span>
        <Price
          parts={plan.price}
          className={styles.stickyPrice}
          unitClassName={styles.stickyUnit}
        />
      </p>
      <PurchaseButton purchase={plan.purchase} className={styles.stickyBuy}>
        {purchaseLabel(plan, planLabels)}
      </PurchaseButton>
      <a
        href={chat.href}
        rel="noopener noreferrer"
        aria-label={chat.label}
        title={chat.label}
        className={styles.stickyChat}
      >
        <Icon name="chat" />
      </a>
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
        {centreBestValue(plans).map((plan) => (
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
