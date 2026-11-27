import { listMediaAssets } from "@masar/db";
import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { MediaBanner } from "@/components/admin/media/media-banner";
import { MediaGrid } from "@/components/admin/media/media-grid";
import { UploadForm } from "@/components/admin/media/upload-form";
import { Card, EmptyState, Notice, noticeText, PageHeader } from "@/components/admin/ui/kit";
import { QueryError } from "@/components/admin/ui/query-error";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { Pagination } from "@/components/admin/ui/pagination";
import { ADMIN_ROUTES } from "@/config/admin";
import { MEDIA_PAGE_SIZE } from "@/config/media-library";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";
import { mediaStatus } from "@/server/media/status";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().media.title };
}

const MAX_PAGE = 10_000;

function pageNumber(value: unknown): number {
  const page = typeof value === "string" && /^[0-9]{1,5}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(page, 1), MAX_PAGE);
}

function pageHref(page: number): string {
  return page > 1 ? `${ADMIN_ROUTES.contentMedia}?page=${String(page)}` : ADMIN_ROUTES.contentMedia;
}

function MediaPagination(props: {
  readonly page: number;
  readonly shown: number;
  readonly total: number;
  readonly text: AdminDictionary["media"];
}) {
  const { page, shown, total, text } = props;
  if (total <= MEDIA_PAGE_SIZE) {
    return null;
  }
  const from = (page - 1) * MEDIA_PAGE_SIZE + 1;
  return (
    <Pagination
      label={text.pagination}
      range={fill(text.range, {
        from: formatNumber(from),
        to: formatNumber(from + shown - 1),
        total: formatNumber(total),
      })}
      previous={{ label: text.newer, href: page > 1 ? pageHref(page - 1) : null }}
      next={{
        label: text.older,
        href: page * MEDIA_PAGE_SIZE < total ? pageHref(page + 1) : null,
      }}
    />
  );
}

/**
 * مكتبة الصور (docs/ADMIN_A3_SLIDER.md §6، §11): حالة الرفع وتنبيه النسخ الاحتياطي، ونموذج الرفع لمن
 * يكتب المحتوى والرفع مفتوح، وشبكة الصور باستعمالها.
 */
export default async function MediaPage(props: PageProps<"/admin/content/media">) {
  const { staff } = await requireStaff("content.read");
  const dictionary = getAdminDictionary();
  const text = dictionary.media;
  const query = await props.searchParams;
  const status = mediaStatus();
  const page = pageNumber(query.page);
  const { items, total } = await listMediaAssets(getDb(), staff.clubId, {
    offset: (page - 1) * MEDIA_PAGE_SIZE,
    limit: MEDIA_PAGE_SIZE,
  });
  return (
    <>
      <PageHeader title={text.title} description={text.lead} />
      <Notice text={noticeText(query.done, dictionary)} />
      <QueryError error={query.error} dictionary={dictionary} />
      <MediaBanner status={status} text={text} />
      {status.uploads && hasPermission(staff.role, "content.write") ? (
        <Card title={text.uploadTitle} narrow>
          <UploadForm text={text} />
        </Card>
      ) : null}
      <Card
        title={text.gridTitle}
        description={total === 0 ? undefined : fill(text.gridLead, { count: formatNumber(total) })}
      >
        {items.length === 0 ? (
          <EmptyState icon="image" title={text.emptyTitle} description={text.emptyLead} />
        ) : (
          <MediaGrid assets={items} text={text} />
        )}
        <MediaPagination page={page} shown={items.length} total={total} text={text} />
      </Card>
    </>
  );
}
