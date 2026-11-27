"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { lookup } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import {
  initialFieldForm,
  type FieldFormState,
  type FormIntent,
  type FormValues,
} from "@/server/admin/field-form";
import { buttonClass, Facts, type ButtonVariant } from "./kit";
import styles from "./ui.module.css";

export type FieldFormAction = (
  previous: FieldFormState,
  formData: FormData,
) => Promise<FieldFormState>;

export interface FieldForm {
  readonly state: FieldFormState;
  readonly formAction: (formData: FormData) => void;
  readonly pending: boolean;
  /** ما كتبه الموظف في الحقل، كما أعاده الخادم. */
  readonly value: (name: string) => string;
  /** نص خطأ الحقل من القاموس، أو undefined. */
  readonly errorOf: (name: string) => string | undefined;
  /** نص خطأ النموذج كله، أو null. */
  readonly formError: string | null;
}

/**
 * حالة نموذج بحقول كثيرة: Server Action بنموذج HTML عادي يعمل بلا JavaScript، ومعه يعود ما كُتب عند
 * الرفض، ويظهر خطأ كل حقل بجانبه، وينتقل التركيز إلى أعلى النموذج بعد كل رد.
 */
export function useFieldForm(
  action: FieldFormAction,
  values: FormValues,
  errors: Readonly<Record<string, string>>,
): FieldForm {
  const [state, formAction, pending] = useActionState(action, initialFieldForm(values));
  const fallback = lookup(errors, "fallback", "");
  const text = (reason: string): string =>
    fill(lookup(errors, reason, fallback), { name: state.detail ?? "" });
  const hasFieldErrors = Object.keys(state.fields).length > 0;
  return {
    state,
    formAction,
    pending,
    value: (name) => state.values[name] ?? "",
    errorOf: (name) => {
      const reason = Object.hasOwn(state.fields, name) ? state.fields[name] : undefined;
      return reason === undefined ? undefined : text(reason);
    },
    formError:
      state.error === null ? (hasFieldErrors ? text("form.fix_fields") : null) : text(state.error),
  };
}

/**
 * أعلى النموذج: رسالة الخطأ إن وُجدت. ينتقل إليه التركيز بعد كل رد من الخادم (خطأ أو خطوة مراجعة)،
 * لا عند أول رسم.
 */
export function FormTop({ form }: { readonly form: FieldForm }) {
  const top = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const { state } = form;
  useEffect(() => {
    if (mounted.current) {
      top.current?.focus();
    }
    mounted.current = true;
  }, [state]);
  return (
    <div ref={top} tabIndex={-1} className={styles.form}>
      {form.formError === null ? null : (
        <p role="alert" className={cx(styles.alert, styles.alertDanger)}>
          {form.formError}
        </p>
      )}
    </div>
  );
}

interface FormButtonProps {
  readonly form: FieldForm;
  readonly intent: FormIntent;
  readonly variant?: ButtonVariant;
  /** زر «عدّل» يعود إلى الحقول بلا فحص المتصفح للحقول الإلزامية. */
  readonly skipValidation?: boolean;
  readonly children: ReactNode;
}

export function FormButton({ form, intent, variant, skipValidation, children }: FormButtonProps) {
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      formNoValidate={skipValidation}
      disabled={form.pending}
      data-pending={form.pending}
      className={buttonClass({ variant: variant ?? "primary", size: "large" })}
    >
      {children}
    </button>
  );
}

export function FormFooter({ children }: { readonly children: ReactNode }) {
  return <div className={styles.formFooter}>{children}</div>;
}

export interface ReviewLabels {
  readonly title: string;
  readonly confirm: string;
  readonly edit: string;
  readonly consequences: readonly string[];
}

interface ReviewStepProps {
  readonly form: FieldForm;
  readonly labels: ReviewLabels;
  readonly variant?: ButtonVariant;
}

/**
 * خطوة المراجعة: الخادم يعيد عرض ما سيُنفَّذ وعواقبه، والقيم تعود حقولًا مخفية فيُفحص كل شيء من جديد
 * عند التأكيد (ومعه رمز القفل المتفائل)، ولا يُنفَّذ إلا ما رُوجع.
 */
export function ReviewStep({ form, labels, variant }: ReviewStepProps) {
  const { state } = form;
  return (
    <>
      <p className={styles.stepTitle}>{labels.title}</p>
      <div data-testid="form-review">
        <Facts items={state.review} />
      </div>
      <ul className={styles.consequences}>
        {labels.consequences.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {Object.entries(state.values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <FormFooter>
        <FormButton form={form} intent="confirm" variant={variant ?? "primary"}>
          {labels.confirm}
        </FormButton>
        <FormButton form={form} intent="edit" variant="ghost" skipValidation>
          {labels.edit}
        </FormButton>
      </FormFooter>
    </>
  );
}

export { styles as formStyles };
