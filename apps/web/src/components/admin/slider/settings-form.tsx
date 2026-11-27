"use client";

import { SLIDER_INTERVAL_MAX_MS, SLIDER_INTERVAL_MIN_MS } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import type { FormValues } from "@/server/admin/field-form";
import {
  FormButton,
  FormFooter,
  FormTop,
  useFieldForm,
  type FieldFormAction,
} from "../ui/field-form";
import { CheckboxField, TextField } from "../ui/fields";

const MS_PER_SECOND = 1_000;

/** إعدادات الشريط في المسودة: الانتقال التلقائي ومدته بحدودها. */
export function SliderSettingsForm({
  action,
  values,
  lockToken,
  dictionary,
  canWrite,
}: {
  readonly action: FieldFormAction;
  readonly values: FormValues;
  readonly lockToken: string;
  readonly dictionary: AdminDictionary;
  readonly canWrite: boolean;
}) {
  const form = useFieldForm(action, values, dictionary.errors);
  const text = dictionary.slider.settings;
  return (
    <form action={form.formAction} noValidate>
      <FormTop form={form} />
      <input type="hidden" name="lockToken" value={lockToken} />
      <div key={form.state.stamp}>
        <CheckboxField
          id="slider-autoplay"
          name="autoplay"
          label={text.autoplay}
          hint={text.autoplayHint}
          defaultChecked={form.value("autoplay") === "on"}
          disabled={!canWrite}
        />
        <TextField
          id="slider-interval"
          name="interval"
          label={text.interval}
          hint={fill(text.intervalHint, {
            min: String(SLIDER_INTERVAL_MIN_MS / MS_PER_SECOND),
            max: String(SLIDER_INTERVAL_MAX_MS / MS_PER_SECOND),
          })}
          error={form.errorOf("interval")}
          defaultValue={form.value("interval")}
          inputMode="numeric"
          dir="ltr"
          readOnly={!canWrite}
        />
      </div>
      {canWrite ? (
        <FormFooter>
          <FormButton form={form} intent="save" variant="secondary">
            {text.save}
          </FormButton>
        </FormFooter>
      ) : null}
    </form>
  );
}
