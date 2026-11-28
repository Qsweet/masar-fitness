"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { lookup } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { EMPTY_FORM_STATE, type AdminFormState } from "@/server/admin/form";
import { buttonClass, type ButtonVariant } from "./ui/kit";
import { SaveBar } from "./ui/save-bar";
import { uiStyles as styles } from "./ui/ui-styles";

export type AdminAction = (previous: AdminFormState, formData: FormData) => Promise<AdminFormState>;

export interface AdminFormLabels {
  readonly submit: string;
  /** نصوص الأسباب من قاموس اللوحة (`errors`)، ومنها `fallback`. */
  readonly errors: Readonly<Record<string, string>>;
}

interface AdminFormProps {
  readonly action: AdminAction;
  readonly labels: AdminFormLabels;
  readonly variant?: ButtonVariant;
  /** الحقول والزر في صف واحد (نماذج الإدارة القصيرة). */
  readonly inline?: boolean;
  /** زر بعرض النموذج (بطاقة صفحات البوابة)؛ وإلا تذييل بشريط الحفظ. */
  readonly block?: boolean;
  readonly children?: ReactNode;
}

interface SubmitActionProps {
  readonly pending: boolean;
  readonly variant: ButtonVariant;
  readonly block: boolean;
  readonly label: string;
}

function SubmitAction({ pending, variant, block, label }: SubmitActionProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      data-pending={pending}
      className={buttonClass({ variant, block, size: block ? "large" : "medium" })}
    >
      {label}
    </button>
  );
}

/**
 * نموذج لوحة التحكم: Server Action بنموذج HTML عادي يعمل بلا JavaScript، ومعه يتعطل الزر أثناء
 * الانتظار بمؤشر دوّار (بلا تغيّر في عرضه) وينتقل التركيز إلى رسالة الخطأ. الحقول أبناء من الخادم.
 */
export function AdminForm({
  action,
  labels,
  variant = "primary",
  inline,
  block,
  children,
}: AdminFormProps) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    alert.current?.focus();
  }, [state]);
  const fallback = lookup(labels.errors, "fallback", "");
  return (
    <form action={formAction} className={styles.form}>
      {state.error === null ? null : (
        <p ref={alert} tabIndex={-1} role="alert" className={cx(styles.alert, styles.alertDanger)}>
          {lookup(labels.errors, state.error, fallback)}
        </p>
      )}
      <div className={inline === true ? styles.inlineForm : styles.form}>
        {children}
        {inline === true || block === true ? (
          <SubmitAction
            pending={pending}
            variant={variant}
            block={block === true}
            label={labels.submit}
          />
        ) : (
          <SaveBar unsaved={state.error !== null}>
            <SubmitAction pending={pending} variant={variant} block={false} label={labels.submit} />
          </SaveBar>
        )}
      </div>
    </form>
  );
}
