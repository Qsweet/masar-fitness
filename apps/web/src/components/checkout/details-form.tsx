"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import { MAX_MOBILE_INPUT_LENGTH, MAX_NAME_INPUT_LENGTH } from "@/config/checkout";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { submitCheckout } from "@/server/checkout/actions";
import type { CheckoutField } from "@/server/checkout/form-schema";
import type { CheckoutFormState } from "@/server/checkout/form-state";
import { errorText } from "./error-text";
import { errorId, FIELD_IDS, FIELD_ORDER } from "./field-ids";
import styles from "./fields.module.css";

const MOBILE_HINT_ID = "buyer-mobile-hint";

/** نصوص الشراء وحدها تُمرَّر من الخادم: القاموس لا يدخل حزمة المتصفح (ADMIN_A3_CONTENT §4.2). */
type Labels = Pick<Dictionary, "checkout">;

export interface DetailsFormProps {
  readonly locale: Locale;
  readonly labels: Dictionary["checkout"];
  readonly initialState: CheckoutFormState;
  readonly slug: string;
  readonly addonSlugs: readonly string[];
  /** الكوبون منظَّفًا كما سُعِّر في الملخص. */
  readonly coupon: string;
  readonly whatsappHref: string;
  readonly plansHref: string;
}

type SummaryProps = Pick<DetailsFormProps, "whatsappHref" | "plansHref"> & {
  readonly state: CheckoutFormState;
  readonly dictionary: Labels;
};

/** بديل لأخطاء لا يصلحها تعديل الحقول: باقة أخرى إن لم يعد المنتج متاحًا، وإلا واتساب. */
function FormRemedy({ reason, ...props }: Omit<SummaryProps, "state"> & { reason: string }) {
  const { form } = props.dictionary.checkout;
  if (reason === "cart.product_unavailable") {
    return <a href={props.plansHref}>{form.plansInstead}</a>;
  }
  return (
    <a href={props.whatsappHref} rel="noopener noreferrer">
      {form.whatsappInstead}
    </a>
  );
}

function ErrorItem({
  field,
  reason,
  ...props
}: Omit<SummaryProps, "state"> & {
  field: CheckoutField;
  reason: string;
}) {
  const text = errorText(reason, props.dictionary);
  if (field === "form") {
    return (
      <li>
        <span id={errorId("form")}>{text}</span> <FormRemedy reason={reason} {...props} />
      </li>
    );
  }
  return (
    <li>
      <a href={`#${FIELD_IDS[field]}`}>{text}</a>
    </li>
  );
}

/** ملخص الأخطاء والتنبيه أعلى النموذج: يأخذ التركيز بعد كل محاولة، وكل خطأ رابط إلى حقله. */
function Summary({ state, ...props }: SummaryProps) {
  const { form } = props.dictionary.checkout;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [state]);
  const fields = FIELD_ORDER.filter((field) => state.errors[field] !== undefined);
  const notice = { price_changed: form.priceChanged, data_changed: form.dataChanged };
  if (fields.length === 0 && state.notice === null) {
    return null;
  }
  return (
    <div ref={ref} tabIndex={-1} role="alert" className={styles.summary}>
      {state.notice === null ? null : <p>{notice[state.notice]}</p>}
      {fields.length === 0 ? null : <p className={styles.summaryTitle}>{form.errorSummary}</p>}
      <ul>
        {fields.map((field) => (
          <ErrorItem key={field} field={field} reason={state.errors[field] ?? ""} {...props} />
        ))}
      </ul>
    </div>
  );
}

/** خصائص الوصول للحقل: التلميح ورسالة الخطأ بجانبه مربوطان بـaria-describedby. */
function fieldAria(field: "name" | "mobile", state: CheckoutFormState, hintId?: string) {
  const invalid = state.errors[field] !== undefined;
  return {
    "aria-describedby": cx(hintId, invalid && errorId(field)) || undefined,
    "aria-invalid": invalid || undefined,
  };
}

interface FieldProps {
  readonly field: "name" | "mobile";
  readonly label: string;
  readonly hint?: { readonly id: string; readonly text: string };
  readonly state: CheckoutFormState;
  readonly dictionary: Labels;
  readonly children: ReactNode;
}

/** تسمية وتلميح وحقل ورسالة خطئه بجانبه. */
function Field({ field, label, hint, state, dictionary, children }: FieldProps) {
  const reason = state.errors[field];
  return (
    <div className={styles.field}>
      <label htmlFor={FIELD_IDS[field]} className={styles.label}>
        {label}
      </label>
      {hint === undefined ? null : (
        <p id={hint.id} className={styles.hint}>
          {hint.text}
        </p>
      )}
      {children}
      {reason === undefined ? null : (
        <p id={errorId(field)} className={styles.error}>
          {errorText(reason, dictionary)}
        </p>
      )}
    </div>
  );
}

function BuyerFields({ state, dictionary }: { state: CheckoutFormState; dictionary: Labels }) {
  const { form } = dictionary.checkout;
  const shared = { state, dictionary };
  return (
    <>
      <Field field="name" label={form.name} {...shared}>
        <input
          id={FIELD_IDS.name}
          name="name"
          defaultValue={state.values.name}
          autoComplete="name"
          maxLength={MAX_NAME_INPUT_LENGTH}
          required
          className={styles.input}
          {...fieldAria("name", state)}
        />
      </Field>
      <Field
        field="mobile"
        label={form.mobile}
        hint={{ id: MOBILE_HINT_ID, text: form.mobileHint }}
        {...shared}
      >
        <input
          id={FIELD_IDS.mobile}
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          defaultValue={state.values.mobile}
          maxLength={MAX_MOBILE_INPUT_LENGTH}
          required
          className={styles.input}
          {...fieldAria("mobile", state, MOBILE_HINT_ID)}
        />
      </Field>
    </>
  );
}

function HiddenFields({ props, state }: { props: DetailsFormProps; state: CheckoutFormState }) {
  return (
    <>
      <input type="hidden" name="idempotencyKey" value={state.idempotencyKey} />
      <input type="hidden" name="quotedTotalMinor" value={String(state.quotedTotalMinor)} />
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="coupon" value={props.coupon} />
      {props.addonSlugs.map((slug) => (
        <input key={slug} type="hidden" name="addon" value={slug} />
      ))}
    </>
  );
}

/**
 * نموذج بيانات المشتري، المكوّن العميل الوحيد في الشراء. يعمل بلا JavaScript (Server Action
 * بنموذج HTML عادي)، ومعه يمنع الضغطة الثانية أثناء الانتظار. المفتاح نفسه في المحاولتين ⇒ طلب واحد.
 */
export function DetailsForm(props: DetailsFormProps) {
  const [state, formAction, pending] = useActionState(submitCheckout, props.initialState);
  const dictionary = { checkout: props.labels };
  const { form } = dictionary.checkout;
  return (
    <form action={formAction} className={styles.panel} noValidate>
      <h2 className={styles.title}>{form.title}</h2>
      <p className={styles.lead}>{form.lead}</p>
      <Summary
        state={state}
        dictionary={dictionary}
        whatsappHref={props.whatsappHref}
        plansHref={props.plansHref}
      />
      <HiddenFields props={props} state={state} />
      <BuyerFields state={state} dictionary={dictionary} />
      <div className={styles.actions}>
        <p className={styles.total} data-testid="confirm-total">
          <span>{form.total}</span>
          <Price parts={state.total} className={styles.totalPrice} />
        </p>
        <button
          type="submit"
          disabled={pending}
          className={cx(buttonClass("primary", true), styles.button)}
        >
          {pending ? form.pending : form.submit}
        </button>
      </div>
    </form>
  );
}
