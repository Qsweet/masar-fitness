import { isUnused, type MediaListItem } from "@masar/db";
import Link from "next/link";
import { MediaPicture } from "@/components/ui/media-picture";
import { mediaAssetPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { Badge } from "../ui/kit";
import styles from "../slider/slider.module.css";

/** شبكة المكتبة: مصغّر وأبعاد واستعمال لكل صورة، والبطاقة كلها رابط صفحتها. */
export function MediaGrid({
  assets,
  text,
}: {
  readonly assets: readonly MediaListItem[];
  readonly text: AdminDictionary["media"];
}) {
  return (
    <ul className={styles.grid} data-testid="media-grid">
      {assets.map((asset) => (
        <li key={asset.id} className={styles.tile}>
          <MediaPicture
            image={asset}
            sizes="(min-width: 64rem) 16rem, 50vw"
            alt=""
            loading="lazy"
            className={styles.tileImage}
          />
          <div className={styles.tileBody}>
            <Link
              href={mediaAssetPath(asset.id)}
              prefetch={false}
              className={styles.tileLink}
              aria-label={fill(text.openLabel, { name: asset.originalName })}
            >
              <bdi>{asset.originalName}</bdi>
            </Link>
            <span className={styles.tileMeta}>
              <span dir="ltr">
                {fill(text.dimensions, {
                  width: String(asset.width),
                  height: String(asset.height),
                })}
              </span>
              <Badge tone={isUnused(asset.usage) ? "neutral" : "success"}>
                {isUnused(asset.usage) ? text.unused : text.used}
              </Badge>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
