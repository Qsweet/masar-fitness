import {
  CONTENT_LOCALES,
  SLIDE_ALT_LIMIT,
  SLIDE_TEXT_FIELDS,
  SLIDE_TEXT_LIMITS,
  type ContentLocale,
} from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { altField, textFieldName } from "@/server/admin/slider/slide-form-names";
import { CountedField } from "../ui/char-counter";
import type { FieldForm } from "../ui/field-form";
import { CheckboxField } from "../ui/fields";
import styles from "./editor.module.css";

type Text = AdminDictionary["slider"];
const DIRECTIONS = { ar: "rtl", en: "ltr" } as const;

interface SectionProps {
  readonly form: FieldForm;
  readonly text: Text;
  readonly locales: AdminDictionary["content"]["locales"];
  /** النص المنشور الآن لكل حقل (لشريحة منشورة)، ليظهر بجانب الحقل حين يختلف. */
  readonly published: Readonly<Record<string, string>>;
  readonly readOnly: boolean;
}

function Field({
  form,
  text,
  name,
  label,
  limit,
  locale,
  published,
  readOnly,
}: Omit<SectionProps, "locales" | "published"> & {
  readonly name: string;
  readonly label: string;
  readonly limit: number;
  readonly locale: ContentLocale;
  readonly published: string | undefined;
}) {
  const value = form.value(name);
  return (
    <div className={styles.side}>
      <CountedField
        id={`slide-${name.replaceAll(".", "-")}`}
        name={name}
        label={label}
        defaultValue={value}
        limit={limit}
        counterText={(count) =>
          fill(text.form.counter, { count: String(count), limit: String(limit) })
        }
        multiline={false}
        dir={DIRECTIONS[locale]}
        lang={locale}
        error={form.errorOf(name)}
        readOnly={readOnly}
      />
      {published === undefined || published === value ? null : (
        <p className={styles.note}>
          {text.form.publishedNow} <bdi dir={DIRECTIONS[locale]}>{published || "—"}</bdi>
        </p>
      )}
    </div>
  );
}

/** النصوص فوق الصورة: لكل حقل اللغتان متجاورتان بعدّاد، والمنشور الآن تحتهما حين يختلف. */
export function TextsSection(props: SectionProps) {
  const { text, locales } = props;
  return (
    <section className={styles.section} aria-labelledby="slide-texts-title">
      <h2 id="slide-texts-title" className={styles.sectionTitle}>
        {text.form.textsTitle}
      </h2>
      <p className={styles.sectionLead}>{text.form.textsLead}</p>
      {SLIDE_TEXT_FIELDS.map((field) => (
        <div key={field} className={styles.pair}>
          {CONTENT_LOCALES.map((locale) => (
            <Field
              key={locale}
              {...props}
              name={textFieldName(locale, field)}
              label={fill(text.form.fieldLabel, {
                field: text.form.fields[field],
                locale: locales[locale],
              })}
              limit={SLIDE_TEXT_LIMITS[field]}
              locale={locale}
              published={props.published[textFieldName(locale, field)]}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

/** النص البديل باللغتين، وخيار «زخرفية» الذي يعفي منه. */
export function AltSection(props: SectionProps) {
  const { form, text, locales } = props;
  return (
    <section className={styles.section} aria-labelledby="slide-alt-title">
      <h2 id="slide-alt-title" className={styles.sectionTitle}>
        {text.form.altTitle}
      </h2>
      <p className={styles.sectionLead}>{text.form.altLead}</p>
      <CheckboxField
        id="slide-decorative"
        name="decorative"
        label={text.form.decorative}
        hint={text.form.decorativeHint}
        defaultChecked={form.value("decorative") === "on"}
        disabled={props.readOnly}
      />
      <div className={styles.pair}>
        {CONTENT_LOCALES.map((locale) => (
          <Field
            key={locale}
            {...props}
            name={altField(locale)}
            label={fill(text.form.alt, { locale: locales[locale] })}
            limit={SLIDE_ALT_LIMIT}
            locale={locale}
            published={props.published[altField(locale)]}
          />
        ))}
      </div>
    </section>
  );
}
