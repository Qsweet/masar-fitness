import { assetUsage, findAsset, isUnused } from "@masar/db";
import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetFacts, AssetUsageCard, DeleteCard } from "@/components/admin/media/asset-parts";
import { Card, CardGrid, Notice, noticeText, PageHeader } from "@/components/admin/ui/kit";
import { MediaPicture } from "@/components/ui/media-picture";
import { getAdminDictionary } from "@/i18n/admin";
import { clubTimezone } from "@/server/admin/content/timezone";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";
import styles from "@/components/admin/slider/slider.module.css";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().media.asset.title };
}

/**
 * صفحة صورة (docs/ADMIN_A3_SLIDER.md §6.3): نسخها، وأين تُستعمل، والحذف النهائي للمالك حين لا يستعملها
 * شيء. صورة في شريحة أو إصدار لا تُحذف أبدًا (والقاعدة تمنعه أيضًا).
 */
export default async function MediaAssetPage(props: PageProps<"/admin/content/media/[id]">) {
  const { staff } = await requireStaff("content.read");
  const { id } = await props.params;
  const asset = isUuid(id) ? await findAsset(getDb(), staff.clubId, id) : null;
  if (asset === null) {
    notFound();
  }
  const dictionary = getAdminDictionary();
  const text = dictionary.media;
  const separator = dictionary.content.listSeparator;
  const [usage, timeZone] = await Promise.all([
    assetUsage(getDb(), asset.id),
    clubTimezone(staff.clubId),
  ]);
  return (
    <>
      <PageHeader title={asset.originalName} description={text.asset.title} />
      <Notice text={noticeText((await props.searchParams).done, dictionary)} />
      <Card flush>
        <MediaPicture
          image={asset}
          sizes="(min-width: 64rem) 60rem, 100vw"
          alt=""
          loading="eager"
          className={styles.assetImage}
        />
      </Card>
      <CardGrid>
        <AssetFacts asset={asset} timeZone={timeZone} text={text} separator={separator} />
        <AssetUsageCard usage={usage} text={text} separator={separator} />
      </CardGrid>
      <DeleteCard
        assetId={asset.id}
        canPurge={hasPermission(staff.role, "content.purge")}
        unused={isUnused(usage)}
        dictionary={dictionary}
      />
    </>
  );
}
