import type { ComponentProps, ReactNode } from "react";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import styles from "./controls.module.css";

interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

function FieldShell({ id, label, hint, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  /** حقل رمز التحقق: أرقام كبيرة متباعدة. */
  readonly code?: boolean;
};

/** حقل نصي بتسميته وتلميحه (مربوط بـaria-describedby). */
export function TextField({ id, label, hint, code, ...input }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} {...(hint === undefined ? {} : { hint })}>
      <input
        id={id}
        className={cx(styles.input, code === true && styles.code)}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        {...input}
      />
    </FieldShell>
  );
}

interface SelectFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly hint?: string;
  readonly defaultValue?: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

export function SelectField({ id, name, label, hint, defaultValue, options }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} {...(hint === undefined ? {} : { hint })}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className={styles.input}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** أصناف زر اللوحة لاستعمالها على رابط أو زر نموذج بسيط. */
export function adminButton(variant: "primary" | "outline" | "ghost", block = false): string {
  return cx(styles.button, styles[variant], block && styles.block);
}

/** نص تنبيه النجاح من قيمة `?done=` في الرابط؛ undefined لقيمة مجهولة أو غائبة. */
export function noticeText(
  done: string | string[] | undefined,
  dictionary: AdminDictionary,
): string | undefined {
  const text = typeof done === "string" ? lookup(dictionary.notices, done, "") : "";
  return text === "" ? undefined : text;
}

/** تنبيه نجاح بعد إجراء (من `?done=` في الرابط). */
export function Notice({ text }: { readonly text: string | undefined }) {
  return text === undefined ? null : (
    <p role="status" className={styles.notice}>
      {text}
    </p>
  );
}
