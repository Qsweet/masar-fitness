import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import { DiffList } from "@/components/admin/content/diff-list";
import { Alert, Card, EmptyState, PageHeader, uiStyles } from "@/components/admin/ui/kit";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { rollbackContentAction } from "@/server/admin/actions/content-publish";
import { draftSummary } from "@/server/admin/content/overview";
import { loadRelease, rollbackChanges } from "@/server/admin/content/release-view";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.breadcrumbs.rollback };
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
  const [changes, draft] = await Promise.all([
    rollbackChanges(staff.clubId, view),
    draftSummary(staff.clubId),
  ]);
  const latest = view.latest;
  const isCurrent = latest?.id === view.release.id;
  return (
    <>
      <PageHeader
        title={fill(text.rollback.title, { seq: formatNumber(view.release.seq) })}
        description={text.rollback.lead}
      />
      <Card title={text.rollback.whatTitle}>
        {changes.length === 0 ? (
          <EmptyState
            icon="texts"
            title={isCurrent ? text.rollback.isCurrent : text.rollback.nothing}
          />
        ) : (
          <DiffList changes={changes} text={text} />
        )}
      </Card>
      {isCurrent || latest === null || changes.length === 0 ? null : (
        <Card narrow>
          {draft.dirty ? (
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
                <input type="hidden" name="releaseId" value={view.release.id} />
                <input type="hidden" name="expectedLatestId" value={latest.id} />
              </AdminForm>
            </>
          )}
        </Card>
      )}
    </>
  );
}
