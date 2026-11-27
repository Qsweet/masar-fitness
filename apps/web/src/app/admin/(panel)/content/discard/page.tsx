import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { ContentDiff } from "@/components/admin/content/content-diff";
import { Card, EmptyState, PageHeader, uiStyles } from "@/components/admin/ui/kit";
import { getAdminDictionary } from "@/i18n/admin";
import { discardDraftAction } from "@/server/admin/actions/content-publish";
import { draftSummary } from "@/server/admin/content/overview";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.discard.title };
}

/** تأكيد تجاهل المسودة (ADMIN_A3_CONTENT §8.5): ما سيضيع، ثم الزر ببصمة ما رُوجع. */
export default async function ContentDiscardPage() {
  const { staff } = await requireStaff("content.publish");
  const dictionary = getAdminDictionary();
  const text = dictionary.content;
  const summary = await draftSummary(staff.clubId);
  return (
    <>
      <PageHeader title={text.discard.title} description={text.discard.lead} />
      {summary.dirty ? (
        <>
          <Card title={text.discard.whatTitle}>
            <ContentDiff
              changes={summary.changes}
              sliderChanges={summary.sliderChanges}
              dictionary={dictionary}
            />
          </Card>
          <Card narrow>
            <ul className={uiStyles.consequences}>
              {text.discard.consequences.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <AdminForm
              action={discardDraftAction}
              labels={{ submit: text.discard.submit, errors: dictionary.errors }}
              variant="danger"
            >
              <input type="hidden" name="digest" value={summary.digest} />
            </AdminForm>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState icon="texts" title={text.discard.nothing} />
        </Card>
      )}
    </>
  );
}
