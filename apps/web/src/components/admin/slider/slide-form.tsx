"use client";

import { DESKTOP_IMAGE_MIN_WIDTH, MOBILE_IMAGE_MIN_WIDTH } from "@masar/domain";
import { useState, type SyntheticEvent } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import type { FormValues } from "@/server/admin/field-form";
import { SLIDE_FIELDS } from "@/server/admin/slider/slide-form-names";
import {
  FormButton,
  FormFooter,
  FormTop,
  useFieldForm,
  type FieldForm,
  type FieldFormAction,
} from "../ui/field-form";
import { useEnhanced } from "@/components/ui/use-enhanced";
import { ImagePicker } from "./image-picker";
import { DisplaySection, LinkSection } from "./slide-form-link";
import { AltSection, TextsSection } from "./slide-form-texts";
import { SlidePreview } from "./slide-preview";
import type { AssetOption, TargetOption } from "./types";
import styles from "./editor.module.css";

interface SlideFormProps {
  readonly action: FieldFormAction;
  readonly id: string;
  readonly lockToken: string;
  readonly values: FormValues;
  readonly published: Readonly<Record<string, string>>;
  readonly assets: readonly AssetOption[];
  readonly targets: readonly TargetOption[];
  readonly timeZone: string;
  readonly dictionary: AdminDictionary;
}

/** قيم النموذج الآن من الحقول نفسها (المعاينة الحية تقرؤها عند كل إدخال). */
function formValues(form: HTMLFormElement): FormValues {
  return Object.fromEntries(
    [...new FormData(form).entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function Images({
  form,
  assets,
  text,
}: {
  form: FieldForm;
  assets: readonly AssetOption[];
  text: AdminDictionary["slider"];
}) {
  return (
    <section className={styles.section} aria-labelledby="slide-images-title">
      <h2 id="slide-images-title" className={styles.sectionTitle}>
        {text.form.imagesTitle}
      </h2>
      <p className={styles.sectionLead}>{text.form.imagesLead}</p>
      <ImagePicker
        name={SLIDE_FIELDS.desktop}
        legend={text.form.desktop}
        hint={fill(text.form.desktopHint, { min: String(DESKTOP_IMAGE_MIN_WIDTH) })}
        assets={assets}
        value={form.value(SLIDE_FIELDS.desktop)}
        error={form.errorOf("desktop")}
        text={text}
      />
      <ImagePicker
        name={SLIDE_FIELDS.mobile}
        legend={text.form.mobile}
        hint={fill(text.form.mobileHint, { min: String(MOBILE_IMAGE_MIN_WIDTH) })}
        assets={assets}
        value={form.value(SLIDE_FIELDS.mobile)}
        error={form.errorOf("mobile")}
        noneLabel={text.form.noMobile}
        text={text}
      />
    </section>
  );
}

/**
 * نموذج الشريحة (docs/ADMIN_A3_SLIDER.md §11) بعدّة نصوص A3: Server Action بنموذج HTML يعمل بلا
 * JavaScript، وما كُتب يعود عند الرفض بخطأ كل حقل بجانبه، والمعاينة الحية بجانب الحقول.
 */
export function SlideForm(props: SlideFormProps) {
  const { dictionary } = props;
  const text = dictionary.slider;
  const form = useFieldForm(props.action, props.values, dictionary.errors);
  const enhanced = useEnhanced();
  const [live, setLive] = useState({ stamp: form.state.stamp, values: form.state.values });
  const current = live.stamp === form.state.stamp ? live.values : form.state.values;
  const onInput = (event: SyntheticEvent<HTMLFormElement>) => {
    setLive({ stamp: form.state.stamp, values: formValues(event.currentTarget) });
  };
  const shared = { form, text, published: props.published, readOnly: false };
  return (
    <form action={form.formAction} noValidate onInput={onInput} onChange={onInput}>
      <FormTop form={form} />
      <input type="hidden" name={SLIDE_FIELDS.id} value={props.id} />
      <input type="hidden" name={SLIDE_FIELDS.lockToken} value={props.lockToken} />
      <div className={styles.editor} key={form.state.stamp}>
        <div className={styles.editorFields}>
          <Images form={form} assets={props.assets} text={text} />
          <AltSection {...shared} locales={dictionary.content.locales} />
          <TextsSection {...shared} locales={dictionary.content.locales} />
          <LinkSection
            form={form}
            text={text}
            targets={props.targets}
            kind={enhanced ? (current[SLIDE_FIELDS.linkKind] ?? "none") : null}
          />
          <DisplaySection form={form} text={text} timeZone={props.timeZone} />
          <FormFooter form={form}>
            <FormButton form={form} intent="save">
              {props.id === "" ? text.form.create : text.form.save}
            </FormButton>
            <span className={styles.note}>{text.form.saveNote}</span>
          </FormFooter>
        </div>
        <aside className={styles.editorAside}>
          <SlidePreview values={current} assets={props.assets} text={text} />
        </aside>
      </div>
    </form>
  );
}
