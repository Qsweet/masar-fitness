"use client";

import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { saveSalesSettingsAction } from "@/server/admin/actions/sales-settings";
import type { FormValues } from "@/server/admin/field-form";
import {
  formStyles,
  FormButton,
  FormFooter,
  FormTop,
  ReviewStep,
  useFieldForm,
  type FieldForm,
} from "../ui/field-form";
import { SelectField, TextField } from "../ui/fields";
import { Disclosure, PointList } from "../ui/section";

type SettingsText = AdminDictionary["sales"]["settings"];

interface SettingsFormProps {
  readonly lockToken: string;
  readonly values: FormValues;
  /** القاعدة غير محسومة الآن: القائمة تبدأ بخيار «لم تُحسم بعد» ولا تقترح قيمة. */
  readonly startRuleUnset: boolean;
  /** أدنى مهلة يقبلها مزوّد الدفع المضبوط، أو null. */
  readonly providerMinimum: number | null;
  readonly text: SettingsText;
  readonly errors: Readonly<Record<string, string>>;
}

function ruleOptions(text: SettingsText, unset: boolean) {
  const rules = Object.entries(text.startRule.options).map(([value, label]) => ({ value, label }));
  return unset ? [{ value: "", label: text.startRule.unset }, ...rules] : rules;
}

type FieldsProps = Pick<SettingsFormProps, "startRuleUnset" | "providerMinimum" | "text"> & {
  readonly form: FieldForm;
};

/**
 * الحقلان، وتحت كل واحد تلميح سطر وما يترتب عليه مطويًّا. ما لم يُحسم بعد يُفتح شرحه: هو شرط القرار.
 */
function SettingsFields({ form, startRuleUnset, providerMinimum, text }: FieldsProps) {
  const windowHint =
    providerMinimum === null
      ? text.window.hint
      : `${text.window.hint} ${fill(text.window.providerMinimum, { minutes: String(providerMinimum) })}`;
  const windowUnset = form.value("windowMinutes") === "";
  return (
    <div key={form.state.stamp} className={formStyles.form}>
      <TextField
        id="settings-window"
        name="windowMinutes"
        label={text.window.label}
        hint={windowHint}
        error={form.errorOf("windowMinutes")}
        defaultValue={form.value("windowMinutes")}
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
      />
      <Disclosure summary={text.window.consequencesTitle} open={windowUnset}>
        <PointList lines={text.window.consequences} />
      </Disclosure>
      <SelectField
        id="settings-startRule"
        name="startRule"
        label={text.startRule.label}
        hint={text.startRule.hint}
        error={form.errorOf("startRule")}
        defaultValue={form.value("startRule")}
        options={ruleOptions(text, startRuleUnset)}
      />
      <Disclosure summary={text.startRule.consequencesTitle} open={startRuleUnset}>
        <PointList
          lines={[...Object.values(text.startRule.consequences), text.startRule.renewalNote]}
        />
      </Disclosure>
    </div>
  );
}

/**
 * مهلة الطلب وقاعدة البدء، وتحت كل حقل ما يترتب عليه. الحفظ بخطوتين: الخادم يعيد عرض القديم والجديد،
 * ولا يكتب إلا بعد التأكيد. بلا قيمة مقترحة لأي من الحقلين.
 */
export function SettingsForm(props: SettingsFormProps) {
  const { lockToken, values, text, errors } = props;
  const form = useFieldForm(saveSalesSettingsAction, values, errors);
  const review = {
    title: text.confirm.title,
    confirm: text.confirm.submit,
    edit: text.confirm.edit,
    consequences: [text.scopeNote],
  };
  return (
    <form
      action={form.formAction}
      className={formStyles.form}
      noValidate
      data-step={form.state.step}
    >
      <FormTop form={form} />
      <input type="hidden" name="lockToken" value={lockToken} />
      {form.state.step === "confirm" ? (
        <ReviewStep form={form} labels={review} />
      ) : (
        <>
          <SettingsFields {...props} form={form} />
          <FormFooter form={form}>
            <FormButton form={form} intent="save">
              {text.review}
            </FormButton>
          </FormFooter>
        </>
      )}
    </form>
  );
}
