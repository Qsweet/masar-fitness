"use client";

import { sectionStyles } from "../ui/section";
import { cx } from "@/lib/cx";
import type { FieldFormState, FormValues } from "@/server/admin/field-form";
import { formStyles, FormButton, FormFooter, FormTop, useFieldForm } from "../ui/field-form";
import { ButtonLink } from "../ui/kit";
import {
  BasicsCard,
  DiscountCard,
  Kept,
  ScopeCard,
  WindowCard,
  type PromotionFormLabels,
  type PromotionProductChoice,
} from "./promotion-form-cards";
import styles from "./sales.module.css";

export interface PromotionFormProps {
  readonly action: (previous: FieldFormState, formData: FormData) => Promise<FieldFormState>;
  /** يولَّد عند رسم صفحة الإنشاء: الإرسال الثاني بالمعرّف نفسه لا ينشئ عرضًا ثانيًا. */
  readonly promotionId: string;
  /** رمز القفل المتفائل (التعديل فقط). */
  readonly lockToken?: string;
  /** إنشاء: النوع والرمز يُكتبان. تعديل: ثابتان. */
  readonly creating: boolean;
  /** هل تُعدَّل شروط الخصم والنطاق والبداية؟ لا بعد أول استخدام. */
  readonly termsEditable: boolean;
  readonly values: FormValues;
  readonly products: readonly PromotionProductChoice[];
  readonly timezone: string;
  readonly labels: PromotionFormLabels;
  readonly types: Readonly<Record<string, string>>;
  readonly submit: string;
  readonly cancel?: { readonly href: string; readonly label: string };
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * نموذج العرض في أربع بطاقات: النوع والاسم، الخصم، النطاق، النافذة والحدود. الحقول التي لا تخص الاختيار
 * الحالي (رمز لعرض تلقائي، مبلغ لخصم بنسبة) تُخفى بـCSS وحده فيعمل بلا JavaScript؛ والخادم هو الحاكم.
 */
export function PromotionForm(props: PromotionFormProps) {
  const { creating, termsEditable, labels, products, timezone, types } = props;
  const form = useFieldForm(props.action, props.values, props.errors);
  const section = { form, labels, products, timezone, types };
  return (
    <form
      action={form.formAction}
      className={cx(formStyles.formStack, styles.promotionForm)}
      noValidate
    >
      <FormTop form={form} />
      <input type="hidden" name="promotionId" value={props.promotionId} />
      <input type="hidden" name="audience" value="anyone" />
      {props.lockToken === undefined ? null : (
        <input type="hidden" name="lockToken" value={props.lockToken} />
      )}
      <div key={form.state.stamp} className={sectionStyles.stack}>
        <BasicsCard {...section} creating={creating} />
        {termsEditable ? (
          <DiscountCard {...section} />
        ) : (
          <Kept form={form} names={["discountKind", "percent", "amount"]} />
        )}
        <ScopeCard {...section} scopeEditable={termsEditable} />
        <WindowCard {...section} startEditable={termsEditable} />
      </div>
      <FormFooter>
        <FormButton form={form} intent="save">
          {props.submit}
        </FormButton>
        {props.cancel === undefined ? null : (
          <ButtonLink href={props.cancel.href} variant="ghost" size="large">
            {props.cancel.label}
          </ButtonLink>
        )}
      </FormFooter>
    </form>
  );
}
