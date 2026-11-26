"use client";

import { useActionState, useEffect, useRef } from "react";
import { lookup } from "@/i18n/admin";
import { fillNodes } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import { settleOrderAction } from "@/server/admin/actions/sales-settle";
import {
  initialSettleState,
  type SettleFormState,
  type SettleValues,
} from "@/server/admin/sales/form-state";
import { CheckboxField, DateField, SelectField, TextAreaField, TextField } from "../ui/fields";
import { buttonClass, Facts, uiStyles } from "../ui/kit";
import styles from "./sales.module.css";

export interface SettleFormLabels {
  readonly stepOne: string;
  readonly stepTwo: string;
  readonly method: string;
  readonly reference: string;
  readonly referenceHint: string;
  readonly receivedOn: string;
  readonly receivedOnHint: string;
  readonly amount: string;
  readonly amountHint: string;
  readonly note: string;
  readonly noteHint: string;
  readonly noteLabel: string;
  readonly review: string;
  readonly restate: string;
  readonly summary: string;
  readonly confirmCheck: string;
  readonly confirm: string;
  readonly edit: string;
  readonly startsNote: string;
  readonly methods: Readonly<Record<string, string>>;
  readonly errors: Readonly<Record<string, string>>;
}

interface SettleFormProps {
  readonly orderId: string;
  readonly reference: string;
  readonly customerName: string;
  readonly values: SettleValues;
  /** حدّا تاريخ الاستلام: يوم إنشاء الطلب واليوم، بتقويم النادي. */
  readonly receivedBounds: { readonly min: string; readonly max: string };
  readonly labels: SettleFormLabels;
}

const REFERENCE_MAX_LENGTH = 64;
const NOTE_MAX_LENGTH = 500;
const AMOUNT_MAX_LENGTH = 32;

function NoteField({ labels, value }: { labels: SettleFormLabels; value: string }) {
  return (
    <TextAreaField
      id="settle-note"
      name="note"
      label={labels.note}
      hint={labels.noteHint}
      defaultValue={value}
      maxLength={NOTE_MAX_LENGTH}
    />
  );
}

type EditProps = Pick<SettleFormProps, "labels" | "receivedBounds"> & {
  readonly values: SettleValues;
  readonly pending: boolean;
};

function EditStep({ labels, receivedBounds, values, pending }: EditProps) {
  const methods = Object.entries(labels.methods).map(([value, label]) => ({ value, label }));
  return (
    <>
      <SelectField
        id="settle-method"
        name="method"
        label={labels.method}
        defaultValue={values.method}
        options={methods}
      />
      <TextField
        id="settle-reference"
        name="externalReference"
        label={labels.reference}
        hint={labels.referenceHint}
        defaultValue={values.externalReference}
        dir="ltr"
        autoComplete="off"
        maxLength={REFERENCE_MAX_LENGTH}
        required
      />
      <DateField
        id="settle-received"
        name="receivedOn"
        label={labels.receivedOn}
        hint={labels.receivedOnHint}
        defaultValue={values.receivedOn}
        min={receivedBounds.min}
        max={receivedBounds.max}
        required
      />
      <TextField
        id="settle-amount"
        name="amount"
        label={labels.amount}
        hint={labels.amountHint}
        defaultValue={values.amount}
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        maxLength={AMOUNT_MAX_LENGTH}
        required
      />
      <NoteField labels={labels} value={values.note} />
      <button
        type="submit"
        name="intent"
        value="review"
        disabled={pending}
        data-pending={pending}
        className={buttonClass({ variant: "primary", size: "large", block: true })}
      >
        {labels.review}
      </button>
    </>
  );
}

type ConfirmProps = Pick<SettleFormProps, "labels" | "reference" | "customerName"> & {
  readonly state: Extract<SettleFormState, { step: "confirm" }>;
  readonly pending: boolean;
};

function ConfirmStep({ labels, reference, customerName, state, pending }: ConfirmProps) {
  const { summary } = state;
  const strong = (key: string, value: string) => (
    <strong key={key}>
      <bdi>{value}</bdi>
    </strong>
  );
  const facts: (readonly [string, string])[] = [
    [labels.amount, summary.amount],
    [labels.method, summary.method],
    [labels.reference, summary.externalReference],
    [labels.receivedOn, summary.receivedOn],
    ...(summary.note === null ? [] : [[labels.noteLabel, summary.note] as const]),
  ];
  return (
    <>
      <p className={styles.restate} data-testid="settle-restate">
        {fillNodes(labels.restate, {
          amount: strong("amount", summary.amount),
          reference: strong("reference", reference),
          external: strong("external", summary.externalReference),
          name: strong("name", customerName),
        })}
      </p>
      <Facts items={facts} />
      <p className={styles.note}>{labels.startsNote}</p>
      <input type="hidden" name="token" value={state.token} />
      <CheckboxField
        id="settle-confirmed"
        name="confirmed"
        value="yes"
        label={labels.confirmCheck}
        required
      />
      <div className={styles.formActions}>
        <button
          type="submit"
          name="intent"
          value="confirm"
          disabled={pending}
          data-pending={pending}
          className={buttonClass({ variant: "primary", size: "large" })}
        >
          {labels.confirm}
        </button>
        <button
          type="submit"
          name="intent"
          value="edit"
          formNoValidate
          disabled={pending}
          className={buttonClass({ variant: "ghost", size: "large" })}
        >
          {labels.edit}
        </button>
      </div>
    </>
  );
}

/**
 * الدفع اليدوي بخطوتين في نموذج واحد (ADMIN_A2_SALES §6.5): الخادم يتحقق ويختم ما كُتب، ثم يعيد عرضه
 * للمراجعة، ولا ينفّذ إلا ما في الرمز المختوم. يعمل بلا JavaScript؛ ومعه ينتقل التركيز إلى رسالة الخطأ
 * أو إلى أول الخطوة الجديدة.
 */
export function SettleForm(props: SettleFormProps) {
  const { orderId, labels, values } = props;
  const [state, formAction, pending] = useActionState(
    settleOrderAction,
    initialSettleState(values),
  );
  const top = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) {
      top.current?.focus();
    }
    mounted.current = true;
  }, [state]);
  const fallback = lookup(labels.errors, "fallback", "");
  return (
    <form action={formAction} className={uiStyles.form} data-step={state.step}>
      <div ref={top} tabIndex={-1} className={styles.stack}>
        <p className={styles.step}>{state.step === "confirm" ? labels.stepTwo : labels.stepOne}</p>
        {state.error === null ? null : (
          <p role="alert" className={cx(uiStyles.alert, uiStyles.alertDanger)}>
            {lookup(labels.errors, state.error, fallback)}
          </p>
        )}
      </div>
      <input type="hidden" name="orderId" value={orderId} />
      {state.step === "confirm" ? (
        <ConfirmStep {...props} state={state} pending={pending} />
      ) : (
        <EditStep {...props} values={state.values} pending={pending} />
      )}
    </form>
  );
}
