import { hasPermission, isServerProvider, isTrackingProvider } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProviderForm } from "@/components/admin/integrations/provider-form";
import { TestEventCard } from "@/components/admin/integrations/test-event-card";
import { TrackingLog } from "@/components/admin/integrations/tracking-log";
import { Alert, Badge, Notice, noticeText, PageHeader } from "@/components/admin/ui/kit";
import { SettingsSection, SettingsStack } from "@/components/admin/ui/section";
import { ADMIN_ROUTES, FALLBACK_TIMEZONE } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { loadProviderView } from "@/server/admin/integrations/view";

type Props = PageProps<"/admin/integrations/[provider]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provider } = await params;
  const { integrations } = getAdminDictionary();
  return isTrackingProvider(provider) ? { title: integrations.providers[provider].name } : {};
}

/**
 * منصة واحدة (ADMIN_A5_TRACKING §8): الإعداد، وحدث الاختبار للمنصات الخادمية، وسجلها. منصة مجهولة 404.
 */
export default async function IntegrationPage(props: Props) {
  const { staff } = await requireStaff("integrations.manage");
  const { provider } = await props.params;
  if (!isTrackingProvider(provider)) {
    notFound();
  }
  const query = await props.searchParams;
  const dictionary = getAdminDictionary();
  const text = dictionary.integrations;
  const [{ card, events }, club] = await Promise.all([
    loadProviderView(staff.clubId, provider),
    staffClub(staff.clubId),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: ADMIN_ROUTES.integrations, label: text.backToHub }}
        title={text.providers[provider].name}
        description={text.providers[provider].lead}
        badge={
          <Badge tone={card.status === "enabled" ? "success" : "neutral"}>
            {text.statuses[card.status]}
          </Badge>
        }
      ></PageHeader>
      <Notice text={noticeText(query.done, dictionary)} />
      {provider === "gtm" ? <Alert tone="info">{text.gtmContainerNote}</Alert> : null}
      {provider === "x" ? <Alert tone="info">{text.xContainerNote}</Alert> : null}
      <SettingsStack>
        <SettingsSection title={text.form.title} description={text.form.lead}>
          <ProviderForm
            provider={provider}
            view={card.view}
            canWriteSecret={hasPermission(staff.role, "integrations.secrets")}
            dictionary={dictionary}
          />
        </SettingsSection>
        {isServerProvider(provider) ? (
          <TestEventCard provider={provider} dictionary={dictionary} />
        ) : null}
        <SettingsSection title={text.log.title} description={text.log.lead} flush>
          <TrackingLog
            events={events}
            timezone={club?.timezone ?? FALLBACK_TIMEZONE}
            dictionary={dictionary}
          />
        </SettingsSection>
      </SettingsStack>
    </>
  );
}
