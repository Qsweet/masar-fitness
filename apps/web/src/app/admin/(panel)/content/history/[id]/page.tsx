import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiffList } from "@/components/admin/content/diff-list";
import { ReleaseFacts } from "@/components/admin/content/release-facts";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/admin/ui/kit";
import { contentPreviewHref, releaseRollbackPath } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { loadRelease } from "@/server/admin/content/release-view";
import { clubTimezone } from "@/server/admin/content/timezone";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.breadcrumbs.release };
}

/** صفحة إصدار (ADMIN_A3_CONTENT §8.5): وصفه، وما غيّره عن سابقه، والاسترجاع لمن يملك النشر. */
export default async function ContentReleasePage(props: PageProps<"/admin/content/history/[id]">) {
  const { staff } = await requireStaff("content.read");
  const { id } = await props.params;
  const view = (await loadRelease(staff.clubId, id)) ?? notFound();
  const text = getAdminDictionary().content;
  const isCurrent = view.latest?.id === view.release.id;
  const canRollback = hasPermission(staff.role, "content.publish") && !isCurrent;
  return (
    <>
      <PageHeader
        title={fill(text.release.title, { seq: formatNumber(view.release.seq) })}
        badge={isCurrent ? <Badge tone="success">{text.release.current}</Badge> : undefined}
      >
        <ButtonLink href={contentPreviewHref(view.release.id)}>{text.preview.release}</ButtonLink>
        {canRollback ? (
          <ButtonLink href={releaseRollbackPath(view.release.id)} variant="danger">
            {text.release.rollback}
          </ButtonLink>
        ) : null}
      </PageHeader>
      <Card narrow>
        <ReleaseFacts
          release={view.release}
          timezone={await clubTimezone(staff.clubId)}
          text={text}
        />
      </Card>
      <Card title={text.release.diffTitle} description={text.release.diffLead}>
        {view.changes.length === 0 ? (
          <EmptyState icon="texts" title={text.release.noDiff} />
        ) : (
          <DiffList changes={view.changes} text={text} />
        )}
      </Card>
    </>
  );
}
