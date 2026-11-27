import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import { ContentDiff } from "@/components/admin/content/content-diff";
import { Alert, Card, EmptyState, PageHeader, uiStyles } from "@/components/admin/ui/kit";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { rollbackContentAction } from "@/server/admin/actions/content-publish";
import { draftSummary } from "@/server/admin/content/overview";
import { loadRelease, rollbackChanges } from "@/server/admin/content/release-view";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.breadcrumbs.rollback };
}

function ConfirmCard({
  dictionary,
  dirty,
  releaseId,
  latestId,
}: {
  readonly dictionary: AdminDictionary;
  readonly dirty: boolean;
  readonly releaseId: string;
  readonly latestId: string;
}) {
  const text = dictionary.content;
  return (
    <Card narrow>
      {dirty ? (
        <Alert tone="warning">
          <span>
            <strong>{text.rollback.dirtyTitle}.</strong> {text.rollback.dirty}
          </span>
        </Alert>
      ) : (
        <>
          <ul className={uiStyles.consequences}>
            {text.rollback.consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <AdminForm
            action={rollbackContentAction}
            labels={{ submit: text.rollback.submit, errors: dictionary.errors }}
            variant="danger"
          >
            <input type="hidden" name="releaseId" value={releaseId} />
            <input type="hidden" name="expectedLatestId" value={latestId} />
          </AdminForm>
        </>
      )}
    </Card>
  );
}

/**
 * تأكيد الاسترجاع (ADMIN_A3_CONTENT §8.5): ما سيعود مقارنةً بالمنشور الآن. والمسودة متغيرة لا زر: تُنشر
 * أو تُتجاهل أولًا، وإلا ضاعت تغييراتها باستبدال المسودة.
 */
export default async function ContentRollbackPage(
  props: PageProps<"/admin/content/history/[id]/rollback">,
) {
  const { staff } = await requireStaff("content.publish");
  const { id } = await props.params;
  const view = (await loadRelease(staff.clubId, id)) ?? notFound();
  const dictionary = getAdminDictionary();
  const text = dictionary.content;
  const [diff, draft] = await Promise.all([
    rollbackChanges(staff.clubId, view),
    draftSummary(staff.clubId),
  ]);
  const latest = view.latest;
  const isCurrent = latest?.id === view.release.id;
  const count = diff.changes.length + diff.sliderChanges.length;
  return (
    <>
      <PageHeader
        title={fill(text.rollback.title, { seq: formatNumber(view.release.seq) })}
        description={text.rollback.lead}
      />
      <Card title={text.rollback.whatTitle}>
        {count === 0 ? (
          <EmptyState
            icon="texts"
            title={isCurrent ? text.rollback.isCurrent : text.rollback.nothing}
          />
        ) : (
          <ContentDiff
            changes={diff.changes}
            sliderChanges={diff.sliderChanges}
            dictionary={dictionary}
          />
        )}
      </Card>
      {isCurrent || latest === null || count === 0 ? null : (
        <ConfirmCard
          dictionary={dictionary}
          dirty={draft.dirty}
          releaseId={view.release.id}
          latestId={latest.id}
        />
      )}
    </>
  );
}
