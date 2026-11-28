import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./ui.module.css";

interface FieldText {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  /** نص خطأ الحقل بعد رفض الخادم: يظهر تحته، ويُربط به لقارئ الشاشة. */
  readonly error?: string | undefined;
}

interface FieldShellProps extends FieldText {
  readonly children: ReactNode;
}

/** ما يصف الحقل لقارئ الشاشة: تلميحه ثم خطؤه. */
function describedBy({ id, hint, error }: FieldText): string | undefined {
  const ids = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ].filter((value) => value !== null);
  return ids.length === 0 ? undefined : ids.join(" ");
}

function invalid(error: string | undefined): true | undefined {
  return error === undefined ? undefined : true;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
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
      {error === undefined ? null : (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "id" | "className"> &
  FieldText & {
    /** حقل رمز التحقق: أرقام كبيرة متباعدة. */
    readonly code?: boolean;
  };

/** حقل نصي بتسميته وتلميحه وخطئه (مربوطة بـaria-describedby). */
export function TextField({ id, label, hint, error, code, ...input }: TextFieldProps) {
  const text = { id, label, hint, error };
  return (
    <FieldShell {...text}>
      <input
        id={id}
        className={cx(styles.input, code === true && styles.code)}
        aria-describedby={describedBy(text)}
        aria-invalid={invalid(error)}
        {...input}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends FieldText {
  readonly name: string;
  readonly defaultValue?: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

export function SelectField({ name, defaultValue, options, ...text }: SelectFieldProps) {
  return (
    <FieldShell {...text}>
      <select
        id={text.id}
        name={name}
        defaultValue={defaultValue}
        className={styles.input}
        aria-describedby={describedBy(text)}
        aria-invalid={invalid(text.error)}
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

type DateFieldProps = Omit<ComponentProps<"input">, "id" | "className" | "type"> &
  FieldText & {
    /** تاريخ ووقت محليان (‎YYYY-MM-DDTHH:mm‎) بدل تاريخ وحده. */
    readonly withTime?: boolean;
  };

/** حقل تاريخ أصلي (‎YYYY-MM-DD‎ في القيمة)، بمنتقي المتصفح ولوحة المفاتيح. */
export function DateField({ id, label, hint, error, withTime, ...input }: DateFieldProps) {
  const text = { id, label, hint, error };
  return (
    <FieldShell {...text}>
      <input
        id={id}
        type={withTime === true ? "datetime-local" : "date"}
        className={cx(styles.input, styles.dateInput)}
        aria-describedby={describedBy(text)}
        aria-invalid={invalid(error)}
        {...input}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "id" | "className"> & FieldText;

export function TextAreaField({ id, label, hint, error, ...area }: TextAreaFieldProps) {
  const text = { id, label, hint, error };
  return (
    <FieldShell {...text}>
      <textarea
        id={id}
        className={cx(styles.input, styles.textarea)}
        aria-describedby={describedBy(text)}
        aria-invalid={invalid(error)}
        {...area}
      />
    </FieldShell>
  );
}

type CheckboxFieldProps = Omit<ComponentProps<"input">, "id" | "className" | "type"> & {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
};

/** مربع اختيار بتسميته في سطر واحد: هدف لمس كامل الارتفاع، والتسمية تُنقر. */
export function CheckboxField({ id, label, hint, ...input }: CheckboxFieldProps) {
  const box = (
    <label htmlFor={id} className={styles.checkbox}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        {...input}
      />
      <span>{label}</span>
    </label>
  );
  if (hint === undefined) {
    return box;
  }
  return (
    <div className={styles.field}>
      {box}
      <p id={`${id}-hint`} className={styles.hint}>
        {hint}
      </p>
    </div>
  );
}

/** حقلان متجاوران على الشاشة الواسعة (العربي والإنجليزي، السعر والمدة)، وعمود واحد على الهاتف. */
export function FieldRow({ children }: { readonly children: ReactNode }) {
  return <div className={styles.fieldRow}>{children}</div>;
}

interface FieldGroupProps {
  readonly legend: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  /** العنوان لقارئ الشاشة وحده (القسم المحيط يحمل العنوان نفسه ظاهرًا). */
  readonly legendHidden?: boolean;
  readonly children: ReactNode;
}

/** مجموعة حقول بعنوانها (خانات اختيار متعددة، أو صفوف متكررة): `fieldset` حقيقي لقارئ الشاشة. */
export function FieldGroup({ legend, hint, error, legendHidden, children }: FieldGroupProps) {
  return (
    <fieldset className={styles.fieldGroup}>
      <legend className={legendHidden === true ? "sr-only" : styles.label}>{legend}</legend>
      {hint === undefined ? null : <p className={styles.hint}>{hint}</p>}
      {children}
      {error === undefined ? null : <p className={styles.fieldError}>{error}</p>}
    </fieldset>
  );
}
