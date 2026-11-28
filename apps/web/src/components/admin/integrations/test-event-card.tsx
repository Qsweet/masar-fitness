import type { ServerProvider } from "@masar/domain";
import { AdminForm } from "@/components/admin/admin-form";
import { SettingsSection } from "@/components/admin/ui/section";
import { uiStyles } from "@/components/admin/ui/kit";
import type { AdminDictionary } from "@/i18n/admin";
import { sendTestEventAction } from "@/server/admin/actions/integrations";

/** «أرسل حدث اختبار» لمنصة خادمية: النتيجة تنبيه في الصفحة وسطر في السجل بردّ المنصة. */
export function TestEventCard({
  provider,
  dictionary,
}: {
  readonly provider: ServerProvider;
  readonly dictionary: AdminDictionary;
}) {
  const text = dictionary.integrations.test;
  return (
    <SettingsSection title={text.title} description={text.leadByProvider[provider]}>
      <p className={uiStyles.note}>{text.lead}</p>
      <AdminForm
        action={sendTestEventAction}
        labels={{ submit: text.submit, errors: dictionary.errors }}
        variant="secondary"
      >
        <input type="hidden" name="provider" value={provider} />
      </AdminForm>
    </SettingsSection>
  );
}
