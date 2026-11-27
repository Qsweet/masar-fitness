import type { AssetUsage, MediaAsset } from "@masar/db";
import { AdminForm } from "@/components/admin/admin-form";
import type { AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { deleteMediaAction } from "@/server/admin/actions/content-media";
import { Alert, Card, Facts } from "../ui/kit";
import styles from "./media.module.css";

const KIB = 1_024;
type Text = AdminDictionary["media"];

/** وصف الصورة: الاسم والأبعاد والحجم ووقت الرفع والنسخ. */
export function AssetFacts({
  asset,
  timeZone,
  text,
  separator,
}: {
  readonly asset: MediaAsset;
  readonly timeZone: string;
  readonly text: Text;
  readonly separator: string;
}) {
  const dimensions = fill(text.dimensions, {
    width: String(asset.width),
    height: String(asset.height),
  });
  return (
    <Card>
      <Facts
        items={[
          [text.asset.facts.name, <bdi key="name">{asset.originalName}</bdi>],
          [
            text.asset.facts.dimensions,
            <span key="size" dir="ltr">
              {dimensions}
            </span>,
          ],
          [
            text.asset.facts.size,
            fill(text.asset.kilobytes, { kb: formatNumber(Math.round(asset.bytes / KIB)) }),
          ],
          [text.asset.facts.uploaded, formatDateTime(asset.createdAt, timeZone)],
          [
            text.asset.facts.variants,
            fill(text.asset.variants, { widths: asset.widths.join(separator) }),
          ],
        ]}
      />
    </Card>
  );
}

/** أين تُستعمل: مواضع الشرائح في المسودة وأرقام الإصدارات. */
export function AssetUsageCard({
  usage,
  text,
  separator,
}: {
  readonly usage: AssetUsage;
  readonly text: Text;
  readonly separator: string;
}) {
  const draft = usage.draftSlides.map((position) => formatNumber(position + 1)).join(separator);
  const releases = usage.releases.map(formatNumber).join(separator);
  const empty = draft === "" && releases === "";
  return (
    <Card title={text.asset.usageTitle}>
      {empty ? (
        <p>{text.asset.usageNone}</p>
      ) : (
        <ul className={styles.usage}>
          {draft === "" ? null : <li>{fill(text.asset.usageDraft, { list: draft })}</li>}
          {releases === "" ? null : <li>{fill(text.asset.usageReleases, { list: releases })}</li>}
        </ul>
      )}
    </Card>
  );
}

/** الحذف النهائي: للمالك، ولصورة لا يستعملها شيء؛ غير ذلك سبب مكتوب لا زر. */
export function DeleteCard({
  assetId,
  canPurge,
  unused,
  dictionary,
}: {
  readonly assetId: string;
  readonly canPurge: boolean;
  readonly unused: boolean;
  readonly dictionary: AdminDictionary;
}) {
  const text = dictionary.media.asset;
  let body;
  if (!canPurge) {
    body = <Alert tone="info">{text.deleteOwner}</Alert>;
  } else if (unused) {
    body = (
      <AdminForm
        action={deleteMediaAction}
        labels={{ submit: text.deleteSubmit, errors: dictionary.errors }}
        variant="danger"
      >
        <input type="hidden" name="id" value={assetId} />
      </AdminForm>
    );
  } else {
    body = <Alert tone="warning">{text.deleteBlocked}</Alert>;
  }
  return (
    <Card title={text.deleteTitle} description={text.deleteLead} narrow>
      {body}
    </Card>
  );
}
