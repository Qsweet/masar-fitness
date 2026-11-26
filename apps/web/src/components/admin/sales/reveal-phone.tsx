"use client";

import { useActionState } from "react";
import { lookup } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { revealPhoneAction } from "@/server/admin/actions/sales-customers";
import { HIDDEN_PHONE } from "@/server/admin/sales/form-state";
import { buttonClass, SecretValue, uiStyles } from "../ui/kit";
import styles from "./sales.module.css";

export interface RevealPhoneLabels {
  readonly submit: string;
  readonly lead: string;
  readonly revealed: string;
  readonly note: string;
  readonly errors: Readonly<Record<string, string>>;
}

interface RevealPhoneProps {
  readonly source: "order" | "customer";
  /** معرّف الطلب أو العميل، بحسب المصدر. */
  readonly id: string;
  readonly labels: RevealPhoneLabels;
}

/**
 * كشف الجوال الكامل: زر يرسل إجراء خادم، والرقم يرجع في حالة النموذج (لا في رابط ولا في حمولة الصفحة
 * قبل الضغط) ويبقى ظاهرًا حتى مغادرة الصفحة. يعمل بلا JavaScript.
 */
export function RevealPhone({ source, id, labels }: RevealPhoneProps) {
  const [state, formAction, pending] = useActionState(revealPhoneAction, HIDDEN_PHONE);
  if (state.phone !== null) {
    return (
      <div className={styles.reveal} role="status">
        <SecretValue data-testid="revealed-phone" aria-label={labels.revealed}>
          {state.phone}
        </SecretValue>
        <span className={styles.note}>{labels.note}</span>
      </div>
    );
  }
  const fallback = lookup(labels.errors, "fallback", "");
  return (
    <form action={formAction} className={styles.reveal}>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        data-pending={pending}
        className={buttonClass({ size: "small" })}
      >
        {labels.submit}
      </button>
      {state.error === null ? (
        <span className={styles.note}>{labels.lead}</span>
      ) : (
        <p role="alert" className={cx(uiStyles.alert, uiStyles.alertDanger)}>
          {lookup(labels.errors, state.error, fallback)}
        </p>
      )}
    </form>
  );
}
