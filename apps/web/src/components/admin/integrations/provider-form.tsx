import type { IntegrationView } from "@masar/db";
import {
  acceptsTestEventCode,
  fieldsOf,
  isServerProvider,
  type TrackingField,
  type TrackingProvider,
} from "@masar/domain";
import { AdminForm } from "@/components/admin/admin-form";
import { CheckboxField, TextField } from "@/components/admin/ui/fields";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { saveIntegrationAction } from "@/server/admin/actions/integrations";

interface ProviderFormProps {
  readonly provider: TrackingProvider;
  readonly view: IntegrationView | null;
  /** المالك وحده يكتب المفتاح الخادمي (`integrations.secrets`). */
  readonly canWriteSecret: boolean;
  readonly dictionary: AdminDictionary;
}

type Text = AdminDictionary["integrations"]["form"];

function fieldHint(provider: TrackingProvider, field: TrackingField, text: Text): string {
  if (
    field === "pixelId" &&
    (provider === "meta" || provider === "snap" || provider === "tiktok")
  ) {
    return text.pixelHints[provider];
  }
  return text.fields[field].hint;
}

function secretStatus(view: IntegrationView | null, canWrite: boolean, text: Text): string {
  const last4 = view?.secretLast4 ?? null;
  const status = last4 === null ? text.secretUnset : fill(text.secretSet, { last4 });
  return canWrite ? status : `${status} ${text.secretReadOnly}`;
}

/** المفتاح للكتابة فقط: الحقل فارغ دائمًا، وتحته «مضبوط · آخره» أو «غير مضبوط» (§8). */
function SecretFields({ provider, view, canWriteSecret, dictionary }: ProviderFormProps) {
  const text = dictionary.integrations.form;
  if (!isServerProvider(provider)) {
    return <p>{text.browserOnly}</p>;
  }
  const hint = `${text.secretHints[provider]} ${secretStatus(view, canWriteSecret, text)}`;
  if (!canWriteSecret) {
    return <p data-testid="secret-status">{secretStatus(view, false, text)}</p>;
  }
  return (
    <>
      <TextField
        id="integration-secret"
        name="secret"
        type="password"
        label={text.secret}
        hint={hint}
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        defaultValue=""
      />
      {(view?.secretLast4 ?? null) === null ? null : (
        <CheckboxField id="integration-secret-clear" name="clearSecret" label={text.secretClear} />
      )}
    </>
  );
}

/** نموذج إعداد منصة: التفعيل، والمعرّفات العامة بأنماطها، ورمز الاختبار، والمفتاح الخادمي. */
export function ProviderForm(props: ProviderFormProps) {
  const { provider, view, dictionary } = props;
  const text = dictionary.integrations.form;
  return (
    <AdminForm
      action={saveIntegrationAction}
      labels={{ submit: text.submit, errors: dictionary.errors }}
    >
      <input type="hidden" name="provider" value={provider} />
      <CheckboxField
        id="integration-enabled"
        name="enabled"
        label={text.enabled}
        hint={text.enabledHint}
        defaultChecked={view?.enabled === true}
      />
      {fieldsOf(provider).map((field) => (
        <TextField
          key={field}
          id={`integration-${field}`}
          name={field}
          label={text.fields[field].label}
          hint={fieldHint(provider, field, text)}
          defaultValue={view?.config[field] ?? ""}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
        />
      ))}
      {acceptsTestEventCode(provider) ? (
        <TextField
          id="integration-test-code"
          name="testEventCode"
          label={text.testEventCode}
          hint={text.testEventCodeHint}
          defaultValue={view?.testEventCode ?? ""}
          autoComplete="off"
          dir="ltr"
        />
      ) : null}
      <SecretFields {...props} />
    </AdminForm>
  );
}
