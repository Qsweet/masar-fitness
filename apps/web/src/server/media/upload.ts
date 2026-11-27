import "server-only";
import { createMediaAsset, findAssetByHash, staffActor, type Db, type MediaAsset } from "@masar/db";
import { err, ok, singleLine, type Result } from "@masar/domain";
import { MAX_ORIGINAL_NAME_LENGTH } from "@/config/media-library";
import { processImage, sha256Of } from "./process-image";
import { removeAssetFiles, storeVariants } from "./store";

/**
 * رفع صورة إلى المكتبة (docs/ADMIN_A3_SLIDER.md §6.1) بلا اعتماد على Next: البصمة أولًا (صورة رُفعت
 * من قبل ترجع أصلها بلا معالجة)، ثم المعالجة، ثم الملفات، ثم الصف. فشل الصف يحذف ما كُتب الآن.
 */
export interface UploadInput {
  readonly root: string;
  readonly clubId: string;
  readonly staffId: string;
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly now: Date;
}

export interface Uploaded {
  readonly asset: MediaAsset;
  readonly existing: boolean;
}

const PATH_PART = /^.*[\\/]/;
const FALLBACK_NAME = "image";

/** اسم الملف كما أرسله المتصفح، للعرض وحده: بلا مسار ولا محارف تحكم، ومقصوص. */
export function displayName(raw: string): string {
  const name = singleLine(raw.replace(PATH_PART, "")).slice(0, MAX_ORIGINAL_NAME_LENGTH);
  return name === "" ? FALLBACK_NAME : name;
}

export async function uploadImage(db: Db, input: UploadInput): Promise<Result<Uploaded, string>> {
  const known = await findAssetByHash(db, input.clubId, sha256Of(input.bytes));
  if (known !== null) {
    return ok({ asset: known, existing: true });
  }
  const processed = await processImage(input.bytes);
  if (!processed.ok) {
    return err(processed.error);
  }
  const image = processed.value;
  const written = await storeVariants(input.root, input.clubId, image.sha256, image.variants);
  try {
    const created = await createMediaAsset(db, {
      clubId: input.clubId,
      staffId: input.staffId,
      actor: staffActor(input.staffId),
      sha256: image.sha256,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      variantWidths: image.widths,
      blurDataUrl: image.blurDataUrl,
      dominantColor: image.dominantColor,
      originalName: displayName(input.fileName),
      now: input.now,
    });
    return ok(created);
  } catch (error) {
    if (written) {
      await removeAssetFiles(input.root, input.clubId, image.sha256);
    }
    throw error;
  }
}
