"use client";

import type { ContentLocale } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import type { LocaleState, TextStatus } from "@/server/admin/content/namespace-view";
import { CountedField } from "../ui/char-counter";
import {
  FormButton,
  FormFooter,
  FormTop,
  useFieldForm,
  type FieldForm,
  type FieldFormAction,
} from "../ui/field-form";
import { Badge, buttonClass, type Tone } from "../ui/kit";
import { PathText, Placeholders } from "./entry-parts";
import styles from "./content.module.css";

type Text = AdminDictionary["content"];

export interface TextRowView {
  readonly path: string;
  readonly kind: string;
  readonly limit: number;
  readonly multiline: boolean;
  /** حقائق النادي لمن لا يملك `content.facts`: قراءة فقط. */
  readonly readOnly: boolean;
  readonly status: TextStatus;
  readonly defaults: Readonly<Record<ContentLocale, string>>;
  readonly placeholders: Readonly<Record<ContentLocale, readonly string[]>>;
  readonly locales: Readonly<Record<ContentLocale, LocaleState>>;
}

const STATUS_TONES: Readonly<Record<TextStatus, Tone>> = {
  default: "neutral",
  published: "success",
  draft: "info",
  baseChanged: "warning",
};
const LOCALES: readonly ContentLocale[] = ["ar", "en"];
const DIRECTIONS = { ar: "rtl", en: "ltr" } as const;

export function StatusTag({ status, text }: { readonly status: TextStatus; readonly text: Text }) {
  return <Badge tone={STATUS_TONES[status]}>{text.statuses[status]}</Badge>;
}

function fieldName(locale: ContentLocale, path: string) {
  return `v:${locale}:${path}`;
}

interface SideProps {
  readonly row: TextRowView;
  readonly locale: ContentLocale;
  readonly form: FieldForm;
  readonly text: Text;
}

function LocaleSide({ row, locale, form, text }: SideProps) {
  const state = row.locales[locale];
  const name = fieldName(locale, row.path);
  const id = `f-${locale}-${row.path.replaceAll(".", "-")}`;
  const typed = form.state.values[name];
  return (
    <div className={styles.side}>
      <span className={styles.sideLabel}>
        {text.namespace.defaultLabel} · {text.locales[locale]}
      </span>
      <p className={styles.defaultText} dir={DIRECTIONS[locale]} lang={locale}>
        {row.defaults[locale]}
      </p>
      <Placeholders names={row.placeholders[locale]} label={text.namespace.placeholders} />
      <input type="hidden" name={`t:${locale}:${row.path}`} value={state.lockToken} />
      <CountedField
        id={id}
        name={name}
        label={fill(text.form.fieldLabel, { locale: text.locales[locale] })}
        defaultValue={typed ?? state.value}
        limit={row.limit}
        counterText={(count) =>
          fill(text.form.counter, { count: String(count), limit: String(row.limit) })
        }
        multiline={row.multiline}
        dir={DIRECTIONS[locale]}
        lang={locale}
        error={form.errorOf(name)}
        readOnly={row.readOnly}
      />
      {state.published !== null && state.status === "draft" ? (
        <p className={styles.note}>
          {text.form.publishedNow} <bdi>{state.published}</bdi>
        </p>
      ) : null}
      {(state.overridden || state.stored) && !row.readOnly ? (
        <button
          type="submit"
          name="revert"
          value={`${locale}:${row.path}`}
          formNoValidate
          disabled={form.pending}
          className={buttonClass({ variant: "ghost", size: "small" })}
        >
          {text.form.revert}
        </button>
      ) : null}
    </div>
  );
}

interface TextsFormProps {
  readonly action: FieldFormAction;
  readonly namespace: string;
  readonly rows: readonly TextRowView[];
  readonly text: Text;
  readonly errors: Readonly<Record<string, string>>;
  readonly canWrite: boolean;
}

/**
 * نصوص مساحة في نموذج واحد (ADMIN_A3_CONTENT §9): لكل نص الافتراضيان قراءةً وحقلا التجاوز متجاوران
 * (عمود واحد على الهاتف)، وعدّاد الطول، و«عودة إلى الافتراضي». Server Action بنموذج HTML يعمل بلا
 * JavaScript؛ ما كُتب يعود عند الرفض بخطأ كل حقل بجانبه.
 */
export function TextsForm({ action, namespace, rows, text, errors, canWrite }: TextsFormProps) {
  const form = useFieldForm(action, {}, errors);
  return (
    <form action={form.formAction} noValidate>
      <FormTop form={form} />
      <input type="hidden" name="namespace" value={namespace} />
      <ul className={styles.entries} key={form.state.stamp}>
        {rows.map((row) => (
          <li key={row.path} id={`text-${row.path}`} className={styles.entry}>
            <div className={styles.entryHead}>
              <PathText path={row.path} />
              <StatusTag status={row.status} text={text} />
              <span className={styles.note}>{row.kind}</span>
              {row.readOnly ? (
                <span className={styles.note}>{text.namespace.factsOnly}</span>
              ) : null}
            </div>
            {row.status === "baseChanged" ? (
              <p className={styles.warning}>{text.form.baseChanged}</p>
            ) : null}
            <div className={styles.pair}>
              {LOCALES.map((locale) => (
                <LocaleSide key={locale} row={row} locale={locale} form={form} text={text} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      {canWrite ? (
        <FormFooter>
          <FormButton form={form} intent="save">
            {text.form.save}
          </FormButton>
          <span className={styles.note}>{text.form.saveNote}</span>
        </FormFooter>
      ) : null}
    </form>
  );
}
