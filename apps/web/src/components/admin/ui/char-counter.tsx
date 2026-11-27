"use client";

import { textLength } from "@masar/domain";
import { useState } from "react";
import { cx } from "@/lib/cx";
import styles from "./ui.module.css";

interface CountedFieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly limit: number;
  /** نص العدّ بعد ملء `{count}` و`{limit}` (من القاموس). */
  readonly counterText: (count: number) => string;
  readonly multiline: boolean;
  readonly dir: "rtl" | "ltr";
  readonly lang: string;
  readonly error?: string | undefined;
  readonly hintId?: string | undefined;
  readonly readOnly?: boolean;
}

/**
 * حقل نص بعدّاد محارف (CharCounter، ADMIN_A3_CONTENT §9): العدّ بنقاط الترميز كما يعدّها الخادم.
 * بلا JavaScript يُرسم العدّ الأول والحد، ويُفحص الطول بعد الإرسال. العدّاد ليس منطقة حية: لا يُقاطع
 * قارئ الشاشة مع كل حرف، والحد مقروء في وصف الحقل.
 */
export function CountedField(props: CountedFieldProps) {
  const [count, setCount] = useState(() => textLength(props.defaultValue));
  const over = count > props.limit;
  const counterId = `${props.id}-count`;
  const describedBy = [
    props.hintId,
    counterId,
    props.error === undefined ? null : `${props.id}-error`,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ");
  const shared = {
    id: props.id,
    name: props.name,
    defaultValue: props.defaultValue,
    dir: props.dir,
    lang: props.lang,
    readOnly: props.readOnly,
    "aria-describedby": describedBy,
    "aria-invalid": props.error === undefined && !over ? undefined : true,
    onChange: (event: { currentTarget: { value: string } }) => {
      setCount(textLength(event.currentTarget.value));
    },
  } as const;
  return (
    <div className={styles.field}>
      <label htmlFor={props.id} className={styles.label}>
        {props.label}
      </label>
      {props.multiline ? (
        <textarea {...shared} className={cx(styles.input, styles.textarea)} rows={3} />
      ) : (
        <input {...shared} className={styles.input} />
      )}
      <p id={counterId} className={cx(styles.counter, over && styles.counterOver)}>
        {props.counterText(count)}
      </p>
      {props.error === undefined ? null : (
        <p id={`${props.id}-error`} className={styles.fieldError}>
          {props.error}
        </p>
      )}
    </div>
  );
}
