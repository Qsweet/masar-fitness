import type { Metadata } from "next";
import { PointList, SettingsSection } from "@/components/admin/ui/section";
import { AdminForm } from "@/components/admin/admin-form";
import { ContentDiff } from "@/components/admin/content/content-diff";
import { Alert, Card, EmptyState, PageHeader } from "@/components/admin/ui/kit";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { countText } from "@/i18n/count";
import { publishContentAction } from "@/server/admin/actions/content-publish";
import { draftSummary, type DraftSummary } from "@/server/admin/content/overview";
import { sealPublishToken } from "@/server/admin/content/publish-token";
import { adminSecretKey } from "@/server/admin/flag";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.publish.title };
}

function Warnings({
  summary,
  text,
  separator,
}: {
  readonly summary: DraftSummary;
  readonly text: AdminDictionary["content"]["publish"];
  readonly separator: string;
}) {
  return (
    <>
      {summary.lengthWarnings.length === 0 ? null : (
        <Alert tone="warning">
          <span>
            <strong>{text.lengthTitle}.</strong> {text.lengthLead}{" "}
            <bdi>{summary.lengthWarnings.join(separator)}</bdi>
          </span>
        </Alert>
      )}
      {summary.dropped.length === 0 ? null : <Alert tone="warning">{text.droppedNote}</Alert>}
    </>
  );
}

/**
 * مراجعة النشر (ADMIN_A3_CONTENT §8.4): الفرق كاملًا مجمّعًا بالمساحة، والتنبيهات، وزر نشر يحمل رمزًا
 * مختومًا ببصمة ما رُوجع ومعرّف آخر إصدار. تغيّرت المسودة بعدها ⇒ يُرفض النشر ويُطلب مراجعة جديدة.
 */
export default async function ContentPublishPage() {
  const { staff } = await requireStaff("content.publish");
  const dictionary = getAdminDictionary();
  const text = dictionary.content;
  const summary = await draftSummary(staff.clubId);
  const count = summary.changes.length + summary.sliderChanges.length;
  if (count === 0) {
    return (
      <>
        <PageHeader title={text.publish.title} description={text.publish.lead} />
        <Card>
          <EmptyState
            icon="publish"
            title={text.publish.nothing}
            description={text.publish.nothingLead}
          />
        </Card>
      </>
    );
  }
  const token = sealPublishToken(
    adminSecretKey(),
    staff.id,
    { digest: summary.digest, latestId: summary.head?.id ?? null },
    new Date(),
  );
  return (
    <>
      <PageHeader title={text.publish.title} description={text.publish.lead} />
      <Warnings summary={summary} text={text.publish} separator={text.listSeparator} />
      <Card title={fill(text.publish.count, { count: countText(count, text.counts.changes) })}>
        <ContentDiff
          changes={summary.changes}
          sliderChanges={summary.sliderChanges}
          dictionary={dictionary}
        />
      </Card>
      <SettingsSection title={text.publish.confirmTitle} tone="accent">
        <PointList lines={text.publish.consequences} />
        <AdminForm
          action={publishContentAction}
          labels={{ submit: text.publish.submit, errors: dictionary.errors }}
        >
          <input type="hidden" name="token" value={token} />
        </AdminForm>
      </SettingsSection>
    </>
  );
}
