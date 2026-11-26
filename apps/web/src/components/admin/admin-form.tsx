"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { lookup } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { EMPTY_FORM_STATE, type AdminFormState } from "@/server/admin/form";
import styles from "./controls.module.css";

export type AdminAction = (previous: AdminFormState, formData: FormData) => Promise<AdminFormState>;

export interface AdminFormLabels {
  readonly submit: string;
  readonly pending: string;
  /** نصوص الأسباب من قاموس اللوحة (`errors`)، ومنها `fallback`. */
  readonly errors: Readonly<Record<string, string>>;
}

interface AdminFormProps {
  readonly action: AdminAction;
  readonly labels: AdminFormLabels;
  readonly variant?: "primary" | "outline";
  /** الحقول والزر في صف واحد (نماذج الإدارة القصيرة). */
  readonly inline?: boolean;
  readonly children?: ReactNode;
}

/**
 * نموذج لوحة التحكم: Server Action بنموذج HTML عادي يعمل بلا JavaScript، ومعه يمنع الضغطة الثانية
 * أثناء الانتظار وينقل التركيز إلى رسالة الخطأ. الحقول تُمرَّر أبناءً من مكوّن الخادم.
 */
export function AdminForm({
  action,
  labels,
  variant = "primary",
  inline,
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
        <p ref={alert} tabIndex={-1} role="alert" className={styles.error}>
          {lookup(labels.errors, state.error, fallback)}
        </p>
      )}
      <div className={inline === true ? styles.inline : styles.form}>
        {children}
        <button
          type="submit"
          disabled={pending}
          className={cx(styles.button, styles[variant], inline !== true && styles.block)}
        >
          {pending ? labels.pending : labels.submit}
        </button>
      </div>
    </form>
  );
}
