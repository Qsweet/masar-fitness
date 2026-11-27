import { CLICK_TARGETS, SLIDE_LINK_KINDS } from "@masar/domain";
import { fill } from "@/i18n/fill";
import { SLIDE_FIELDS } from "@/server/admin/slider/slide-form-names";
import type { FieldForm } from "../ui/field-form";
import { CheckboxField, DateField, FieldRow, TextField } from "../ui/fields";
import { uiStyles } from "../ui/kit";
import { TARGET_GROUPS, type SliderText, type TargetOption } from "./types";
import styles from "./slider.module.css";

interface LinkProps {
  readonly form: FieldForm;
  readonly text: SliderText;
  readonly targets: readonly TargetOption[];
  /** نوع الرابط الحالي؛ null قبل تحميل JavaScript (تظهر الحقول كلها). */
  readonly kind: string | null;
}

function KindSelect({ form, text }: Pick<LinkProps, "form" | "text">) {
  return (
    <div className={uiStyles.field}>
      <label htmlFor="slide-link-kind" className={uiStyles.label}>
        {text.form.linkKind}
      </label>
      <select
        id="slide-link-kind"
        name={SLIDE_FIELDS.linkKind}
        defaultValue={form.value(SLIDE_FIELDS.linkKind)}
        className={uiStyles.input}
      >
        {SLIDE_LINK_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {text.linkKinds[kind]}
          </option>
        ))}
      </select>
    </div>
  );
}

function InternalSelect({ form, text, targets }: Omit<LinkProps, "kind">) {
  return (
    <div className={uiStyles.field}>
      <label htmlFor="slide-link-internal" className={uiStyles.label}>
        {text.form.internal}
      </label>
      <select
        id="slide-link-internal"
        name={SLIDE_FIELDS.linkInternal}
        defaultValue={form.value(SLIDE_FIELDS.linkInternal)}
        className={uiStyles.input}
        aria-invalid={form.errorOf("link") === undefined ? undefined : true}
      >
        <option value="">—</option>
        {TARGET_GROUPS.map((group) => (
          <optgroup key={group} label={text.linkTargets.groups[group]}>
            {targets
              .filter((target) => target.group === group)
              .map((target) => (
                <option key={target.path} value={target.path}>
                  {target.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/** الرابط: نوعه، ثم الصفحة أو الرابط الخارجي، ثم ما يُنقر. الحقول غير المعنية تُخفى مع JavaScript فقط. */
export function LinkSection({ form, text, targets, kind }: LinkProps) {
  const show = (wanted: string) => kind === null || kind === wanted;
  return (
    <section className={styles.section} aria-labelledby="slide-link-title">
      <h2 id="slide-link-title" className={styles.sectionTitle}>
        {text.form.linkTitle}
      </h2>
      <p className={styles.sectionLead}>{text.form.linkLead}</p>
      <FieldRow>
        <KindSelect form={form} text={text} />
        {show("internal") ? <InternalSelect form={form} text={text} targets={targets} /> : null}
      </FieldRow>
      {show("external") ? (
        <>
          <TextField
            id="slide-link-external"
            name={SLIDE_FIELDS.linkExternal}
            label={text.form.external}
            hint={text.form.externalHint}
            defaultValue={form.value(SLIDE_FIELDS.linkExternal)}
            type="url"
            inputMode="url"
            dir="ltr"
            autoComplete="off"
          />
          <CheckboxField
            id="slide-link-new-tab"
            name={SLIDE_FIELDS.linkNewTab}
            label={text.form.newTab}
            defaultChecked={form.value(SLIDE_FIELDS.linkNewTab) === "on"}
          />
        </>
      ) : null}
      {form.errorOf("link") === undefined ? null : (
        <p className={uiStyles.fieldError} role="alert">
          {form.errorOf("link")}
        </p>
      )}
      {kind === "none" ? null : (
        <fieldset className={styles.radios}>
          <legend className={uiStyles.label}>{text.form.clickTarget}</legend>
          {CLICK_TARGETS.map((target) => (
            <label key={target} className={uiStyles.checkbox}>
              <input
                type="radio"
                name={SLIDE_FIELDS.clickTarget}
                value={target}
                defaultChecked={form.value(SLIDE_FIELDS.clickTarget) === target}
              />
              <span>{text.form.clickTargets[target]}</span>
            </label>
          ))}
          <p className={uiStyles.hint}>{text.form.clickHint}</p>
        </fieldset>
      )}
    </section>
  );
}

/** الظهور والجدولة بتوقيت النادي. */
export function DisplaySection({
  form,
  text,
  timeZone,
}: {
  readonly form: FieldForm;
  readonly text: SliderText;
  readonly timeZone: string;
}) {
  return (
    <section className={styles.section} aria-labelledby="slide-display-title">
      <h2 id="slide-display-title" className={styles.sectionTitle}>
        {text.form.displayTitle}
      </h2>
      <CheckboxField
        id="slide-active"
        name={SLIDE_FIELDS.active}
        label={text.form.active}
        hint={text.form.activeHint}
        defaultChecked={form.value(SLIDE_FIELDS.active) === "on"}
      />
      <FieldRow>
        {(["startsAt", "endsAt"] as const).map((field) => (
          <DateField
            key={field}
            id={`slide-${field}`}
            name={SLIDE_FIELDS[field]}
            label={text.form[field]}
            defaultValue={form.value(SLIDE_FIELDS[field])}
            error={form.errorOf(field)}
            withTime
          />
        ))}
      </FieldRow>
      <p className={uiStyles.hint}>{fill(text.form.scheduleHint, { zone: timeZone })}</p>
    </section>
  );
}
