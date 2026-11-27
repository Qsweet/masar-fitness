import { releaseDetail, type ReleaseDetail } from "@masar/db";
import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { ContentDiff } from "@/components/admin/content/content-diff";
import { ReleaseFacts } from "@/components/admin/content/release-facts";
import {
  Alert,
  ButtonLink,
  Card,
  CardLink,
  EmptyState,
  Notice,
  noticeText,
  PageHeader,
} from "@/components/admin/ui/kit";
import { ADMIN_ROUTES, contentPreviewHref, PREVIEW_DRAFT, releasePath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { countText } from "@/i18n/count";
import { formatNumber } from "@/i18n/format";
import { draftSummary, type DraftSummary } from "@/server/admin/content/overview";
import { clubTimezone } from "@/server/admin/content/timezone";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.overview.title };
}

type Text = AdminDictionary["content"];

function Attention({ summary, text }: { readonly summary: DraftSummary; readonly text: Text }) {
  const lines = [
    summary.baseChanged > 0
      ? `${text.overview.baseChanged}: ${formatNumber(summary.baseChanged)}`
      : null,
    summary.dropped.length > 0
      ? `${text.overview.dropped}: ${formatNumber(summary.dropped.length)}`
      : null,
  ].filter((line) => line !== null);
  return lines.map((line) => (
    <Alert key={line} tone="warning">
      {line}
    </Alert>
  ));
}

function DraftCard({
  summary,
  canPublish,
  dictionary,
}: {
  readonly summary: DraftSummary;
  readonly canPublish: boolean;
  readonly dictionary: AdminDictionary;
}) {
  const text = dictionary.content;
  const count = summary.changes.length + summary.sliderChanges.length;
  return (
    <Card
      title={text.overview.draftTitle}
      description={
        count === 0
          ? undefined
          : fill(text.overview.draftChanges, { count: countText(count, text.counts.changes) })
      }
      action={
        canPublish && summary.dirty ? (
          <CardLink href={ADMIN_ROUTES.contentDiscard}>{text.overview.discard}</CardLink>
        ) : null
      }
    >
      {count === 0 ? (
        <EmptyState icon="texts" title={text.overview.draftClean} />
      ) : (
        <>
          {canPublish ? null : <Alert tone="info">{text.overview.editorNote}</Alert>}
          <ContentDiff
            changes={summary.changes}
            sliderChanges={summary.sliderChanges}
            dictionary={dictionary}
          />
        </>
      )}
    </Card>
  );
}

function LatestCard({
  latest,
  timezone,
  text,
}: {
  readonly latest: ReleaseDetail | null;
  readonly timezone: string;
  readonly text: Text;
}) {
  return (
    <Card
      title={text.overview.latestTitle}
      action={
        latest === null ? null : (
          <CardLink href={releasePath(latest.id)}>{text.overview.open}</CardLink>
        )
      }
      narrow
    >
      {latest === null ? (
        <p>{text.overview.noRelease}</p>
      ) : (
        <ReleaseFacts release={latest} timezone={timezone} text={text} />
      )}
    </Card>
  );
}

/**
 * حالة المحتوى (ADMIN_A3_CONTENT §9): ما في المسودة مقارنةً بالموقع (الفرق كاملًا)، وما يحتاج انتباهًا،
 * وآخر إصدار. أفعال النشر والتجاهل لمن يملك `content.publish`.
 */
export default async function ContentOverviewPage(props: PageProps<"/admin/content">) {
  const { staff } = await requireStaff("content.read");
  const dictionary = getAdminDictionary();
  const text = dictionary.content;
  const summary = await draftSummary(staff.clubId);
  const latest =
    summary.head === null ? null : await releaseDetail(getDb(), staff.clubId, summary.head.id);
  const canPublish = hasPermission(staff.role, "content.publish");
  return (
    <>
      <PageHeader title={text.overview.title} description={text.overview.lead}>
        <ButtonLink href={ADMIN_ROUTES.contentHistory}>{text.overview.history}</ButtonLink>
        <ButtonLink href={contentPreviewHref(PREVIEW_DRAFT)}>{text.preview.draft}</ButtonLink>
        {canPublish && summary.dirty ? (
          <ButtonLink href={ADMIN_ROUTES.contentPublish} variant="primary">
            {text.overview.publish}
          </ButtonLink>
        ) : null}
      </PageHeader>
      <Notice text={noticeText((await props.searchParams).done, dictionary)} />
      <Attention summary={summary} text={text} />
      <DraftCard summary={summary} canPublish={canPublish} dictionary={dictionary} />
      <LatestCard latest={latest} timezone={await clubTimezone(staff.clubId)} text={text} />
    </>
  );
}
