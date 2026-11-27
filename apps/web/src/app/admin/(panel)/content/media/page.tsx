import { listMediaAssets } from "@masar/db";
import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { MediaBanner } from "@/components/admin/media/media-banner";
import { MediaGrid } from "@/components/admin/media/media-grid";
import { UploadForm } from "@/components/admin/media/upload-form";
import { Card, EmptyState, Notice, noticeText, PageHeader } from "@/components/admin/ui/kit";
import { QueryError } from "@/components/admin/ui/query-error";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";
import { mediaStatus } from "@/server/media/status";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().media.title };
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
  const assets = await listMediaAssets(getDb(), staff.clubId);
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
        description={
          assets.length === 0
            ? undefined
            : fill(text.gridLead, { count: formatNumber(assets.length) })
        }
      >
        {assets.length === 0 ? (
          <EmptyState icon="image" title={text.emptyTitle} description={text.emptyLead} />
        ) : (
          <MediaGrid assets={assets} text={text} />
        )}
      </Card>
    </>
  );
}
