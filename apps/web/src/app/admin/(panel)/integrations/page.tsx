import type { Metadata } from "next";
import { ProviderTiles } from "@/components/admin/integrations/provider-tiles";
import { TrackingLog } from "@/components/admin/integrations/tracking-log";
import { Alert, Card, PageHeader } from "@/components/admin/ui/kit";
import { FALLBACK_TIMEZONE } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { loadIntegrationsHub } from "@/server/admin/integrations/view";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().integrations.title };
}

/**
 * «الربط والقياس» (ADMIN_A5_TRACKING §8): حالة كل منصة، وآخر الإرسالات. الكتابة في صفحة كل منصة.
 * للمالك والمدير؛ كل قراءة بنادي الموظف.
 */
export default async function IntegrationsPage() {
  const { staff } = await requireStaff("integrations.manage");
  const dictionary = getAdminDictionary();
  const text = dictionary.integrations;
  const [hub, club] = await Promise.all([
    loadIntegrationsHub(staff.clubId),
    staffClub(staff.clubId),
  ]);
  return (
    <>
      <PageHeader title={text.title} description={text.lead} />
      {hub.gtmOverlap ? <Alert tone="warning">{text.gtmOverlap}</Alert> : null}
      <ProviderTiles cards={hub.cards} dictionary={dictionary} />
      <Card title={text.log.title} description={text.log.lead} flush>
        <TrackingLog
          events={hub.events}
          timezone={club?.timezone ?? FALLBACK_TIMEZONE}
          dictionary={dictionary}
        />
      </Card>
    </>
  );
}
