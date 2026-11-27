"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Price } from "@/components/ui/price";
import { StickyReveal } from "@/components/ui/sticky-reveal";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { DurationSwitch } from "./duration-switch";
import { PlanCard } from "./plan-card";
import { PurchaseButton } from "./purchase-button";
import type { PlanView } from "./plan-view";
import styles from "./plan-picker.module.css";

export interface PlanPickerProps {
  readonly plans: readonly PlanView[];
  readonly initialSlug: string;
  readonly labels: Dictionary["plans"];
  readonly planLabels: Dictionary["plan"];
  /** روابط ثانوية تحت البطاقة (المقارنة والحاسبة). */
  readonly more?: ReactNode;
}

/** المحدِّد كله: شريط الجوال يظهر ما دام على الشاشة. */
const PICKER_ID = "plan-picker";
/** أزرار الشراء في البطاقة: شريط الجوال يختفي ما دامت ظاهرة، فلا يتكرر الزر. */
const ACTIONS_ID = "plan-actions";

function purchaseLabel(plan: PlanView, planLabels: Dictionary["plan"]): string {
  return plan.purchase.kind === "whatsapp" ? planLabels.buyWhatsapp : planLabels.buyOnline;
}

type BarProps = Pick<PlanPickerProps, "planLabels"> & {
  readonly plan: PlanView;
};

/** شريط الشراء الثابت (تحت 64rem): الاسم والإجمالي وزر الشراء، ما دام المحدِّد ظاهرًا وزره لا. */
function StickyBar({ plan, planLabels }: BarProps) {
  return (
    <StickyReveal
      withinId={PICKER_ID}
      hideWhileId={ACTIONS_ID}
      label={planLabels.stickyLabel}
      className={styles.sticky}
    >
      <p className={styles.stickyText}>
        <span className={styles.stickyName}>{plan.tier ?? plan.name}</span>
        <Price
          parts={plan.price}
          className={styles.stickyPrice}
          unitClassName={styles.stickyUnit}
        />
      </p>
      <PurchaseButton purchase={plan.purchase} className={styles.stickyBuy}>
        {purchaseLabel(plan, planLabels)}
      </PurchaseButton>
    </StickyReveal>
  );
}

const noSubscription = () => () => undefined;

/**
 * بعد التحميل فقط: الخادم والترطيب يريان false. بعده يتبع العرضُ الاختيارَ من React
 * (`data-active`) لا قواعد CSS المعدودة، فيعمل أي عدد من الاشتراكات.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/** ما يُعلَن لقارئ الشاشة بعد تغيير المدة: الاسم والإجمالي والمدة كاملة. */
function selectionText(plan: PlanView, labels: Dictionary["plans"]): string {
  return fill(labels.selection, {
    plan: plan.tier ?? plan.name,
    total: `${plan.price.amount} ${plan.price.unit}`,
    duration: plan.durationText,
  });
}

/**
 * محدِّد الاشتراك: مبدّل المدة فوق بطاقة كبيرة واحدة تتبدّل مع الاختيار. كل رقم ونص محسوب على
 * الخادم (plan-view)؛ هنا الاختيار، ودوران السعر من المبلغ السابق، والإعلان لقارئ الشاشة.
 */
export function PlanPicker(props: PlanPickerProps) {
  const { plans, initialSlug, labels, planLabels, more } = props;
  const [slug, setSlug] = useState(initialSlug);
  const [previousAmount, setPreviousAmount] = useState<string | undefined>(undefined);
  const hydrated = useHydrated();
  const selected = plans.find((plan) => plan.slug === slug) ?? plans[0];
  if (selected === undefined) {
    return null;
  }
  const select = (next: string) => {
    setPreviousAmount(selected.price.amount);
    setSlug(next);
  };
  return (
    <div id={PICKER_ID} className={styles.picker} data-hydrated={hydrated ? "" : undefined}>
      <DurationSwitch
        plans={plans}
        selectedSlug={selected.slug}
        labels={labels}
        onSelect={select}
      />
      <PlanCard
        plans={plans}
        activeSlug={selected.slug}
        previousAmount={previousAmount}
        labels={labels}
        planLabels={planLabels}
        actionsId={ACTIONS_ID}
      />
      <p className="sr-only" aria-live="polite">
        {previousAmount === undefined ? "" : selectionText(selected, labels)}
      </p>
      {more === undefined ? null : <div className={styles.more}>{more}</div>}
      <StickyBar plan={selected} planLabels={planLabels} />
    </div>
  );
}
