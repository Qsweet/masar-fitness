import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./ui.module.css";

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
      {children}
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
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

type DateFieldProps = Omit<ComponentProps<"input">, "id" | "className" | "type"> & {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
};

/** حقل تاريخ أصلي (‎YYYY-MM-DD‎ في القيمة)، بمنتقي المتصفح ولوحة المفاتيح. */
export function DateField({ id, label, hint, ...input }: DateFieldProps) {
  return (
    <FieldShell id={id} label={label} {...(hint === undefined ? {} : { hint })}>
      <input
        id={id}
        type="date"
        className={cx(styles.input, styles.dateInput)}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        {...input}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "id" | "className"> & {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
};

export function TextAreaField({ id, label, hint, ...area }: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} {...(hint === undefined ? {} : { hint })}>
      <textarea
        id={id}
        className={cx(styles.input, styles.textarea)}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        {...area}
      />
    </FieldShell>
  );
}

type CheckboxFieldProps = Omit<ComponentProps<"input">, "id" | "className" | "type"> & {
  readonly id: string;
  readonly label: string;
};

/** مربع اختيار بتسميته في سطر واحد: هدف لمس كامل الارتفاع، والتسمية تُنقر. */
export function CheckboxField({ id, label, ...input }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className={styles.checkbox}>
      <input id={id} type="checkbox" {...input} />
      <span>{label}</span>
    </label>
  );
}
