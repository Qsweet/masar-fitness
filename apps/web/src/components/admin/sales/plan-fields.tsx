"use client";

import { useState, useSyncExternalStore } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import {
  BENEFIT_ROWS,
  benefitErrorField,
  benefitField,
  benefitRowCount,
} from "@/server/admin/sales/plan-form";
import { formStyles, type FieldForm } from "../ui/field-form";
import { FieldGroup, FieldRow, TextField } from "../ui/fields";
import { buttonClass } from "../ui/kit";

export type PlanFormLabels = AdminDictionary["sales"]["plans"]["form"];

interface FieldsProps {
  readonly form: FieldForm;
  readonly labels: PlanFormLabels;
  readonly kind: "membership" | "addon";
}

const NAME_MAX = 80;
const SUMMARY_MAX = 200;
const TIER_MAX = 60;

interface PairProps {
  readonly form: FieldForm;
  readonly names: readonly [ar: string, en: string];
  readonly labels: readonly [ar: string, en: string];
  readonly hint: string;
  readonly maxLength: number;
  readonly required?: boolean;
}

/** الحقل نفسه باللغتين متجاورين: العربي ثم الإنجليزي (معزول الاتجاه). */
function LanguagePair({ form, names, labels, hint, maxLength, required }: PairProps) {
  const [ar, en] = names;
  return (
    <FieldRow>
      <TextField
        id={`plan-${ar}`}
        name={ar}
        label={labels[0]}
        hint={hint}
        error={form.errorOf(ar)}
        defaultValue={form.value(ar)}
        maxLength={maxLength}
        required={required}
        autoComplete="off"
      />
      <TextField
        id={`plan-${en}`}
        name={en}
        label={labels[1]}
        error={form.errorOf(en)}
        defaultValue={form.value(en)}
        maxLength={maxLength}
        required={required}
        autoComplete="off"
        dir="ltr"
        lang="en"
      />
    </FieldRow>
  );
}

/** حقول الهوية: الاسمان، الوصفان، اسم الفئة (للاشتراك وحده)، ترتيب العرض. */
export function IdentityFields({ form, labels, kind }: FieldsProps) {
  return (
    <>
      <LanguagePair
        form={form}
        names={["nameAr", "nameEn"]}
        labels={[labels.nameAr, labels.nameEn]}
        hint={labels.nameHint}
        maxLength={NAME_MAX}
        required
      />
      <LanguagePair
        form={form}
        names={["summaryAr", "summaryEn"]}
        labels={[labels.summaryAr, labels.summaryEn]}
        hint={labels.summaryHint}
        maxLength={SUMMARY_MAX}
      />
      {kind === "membership" ? (
        <LanguagePair
          form={form}
          names={["tierAr", "tierEn"]}
          labels={[labels.tierAr, labels.tierEn]}
          hint={labels.tierHint}
          maxLength={TIER_MAX}
        />
      ) : null}
      <FieldRow>
        <TextField
          id="plan-sortOrder"
          name="sortOrder"
          label={labels.sortOrder}
          hint={labels.sortOrderHint}
          error={form.errorOf("sortOrder")}
          defaultValue={form.value("sortOrder")}
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
        />
        <span aria-hidden="true" />
      </FieldRow>
    </>
  );
}

/** السعر بالريال (الخادم هو الحاكم)، والمدة والأشهر المجانية للاشتراك وحده. */
export function TermsFields({ form, labels, kind }: FieldsProps) {
  return (
    <FieldRow>
      <TextField
        id="plan-price"
        name="price"
        label={labels.price}
        hint={labels.priceHint}
        error={form.errorOf("price")}
        defaultValue={form.value("price")}
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        required
      />
      {kind === "membership" ? (
        <>
          <TextField
            id="plan-durationMonths"
            name="durationMonths"
            label={labels.durationMonths}
            hint={labels.durationHint}
            error={form.errorOf("durationMonths")}
            defaultValue={form.value("durationMonths")}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            required
          />
          <TextField
            id="plan-bonusMonths"
            name="bonusMonths"
            label={labels.bonusMonths}
            hint={labels.bonusHint}
            error={form.errorOf("bonusMonths")}
            defaultValue={form.value("bonusMonths")}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
          />
        </>
      ) : null}
    </FieldRow>
  );
}

const subscribeNever = (): (() => void) => () => undefined;

/** هل JavaScript يعمل في المتصفح؟ زر «أضف صفًّا» لا يُرسم بلاه (والصفوف الفارغة الزائدة تكفي). */
function useEnhanced(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

function BenefitRow({ form, labels, index }: Omit<FieldsProps, "kind"> & { index: number }) {
  const row = fill(labels.benefitRow, { number: String(index + 1) });
  const error = form.errorOf(benefitErrorField(index));
  const input = (part: "ar" | "en" | "order", label: string) => ({
    name: benefitField(part, index),
    defaultValue: form.value(benefitField(part, index)),
    "aria-label": `${row}: ${label}`,
    "aria-invalid": error === undefined ? undefined : true,
    placeholder: label,
    autoComplete: "off",
    className: formStyles.input,
  });
  return (
    <div>
      <div className={formStyles.row}>
        <input {...input("ar", labels.benefitAr)} />
        <input {...input("en", labels.benefitEn)} dir="ltr" lang="en" />
        <input {...input("order", labels.benefitOrder)} inputMode="numeric" dir="ltr" />
      </div>
      {error === undefined ? null : <p className={formStyles.fieldError}>{error}</p>}
    </div>
  );
}

/**
 * المزايا صفوفًا (عربي، إنجليزي، ترتيب). بلا JavaScript: المكتوب منها وصفّان فارغان؛ ومعه زر يضيف صفًّا
 * حتى الحد. الترتيب رقم يُكتب، لا سحب وإفلات.
 */
export function BenefitRows({ form, labels }: Omit<FieldsProps, "kind">) {
  const [rows, setRows] = useState(() => benefitRowCount(form.state.values));
  const enhanced = useEnhanced();
  return (
    <FieldGroup
      legend={labels.benefitsTitle}
      hint={labels.benefitsLead}
      error={form.errorOf("benefits")}
    >
      <div className={formStyles.rows}>
        {Array.from({ length: rows }, (_, index) => (
          <BenefitRow key={index} form={form} labels={labels} index={index} />
        ))}
      </div>
      {enhanced && rows < BENEFIT_ROWS ? (
        <div>
          <button
            type="button"
            className={buttonClass({ variant: "ghost", size: "small" })}
            onClick={() => {
              setRows(rows + 1);
            }}
          >
            {labels.addBenefit}
          </button>
        </div>
      ) : null}
    </FieldGroup>
  );
}
