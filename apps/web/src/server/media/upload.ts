import "server-only";
import { createMediaAsset, findAssetByHash, staffActor, type Db, type MediaAsset } from "@masar/db";
import { err, ok, singleLine, type Result } from "@masar/domain";
import { MAX_ORIGINAL_NAME_LENGTH } from "@/config/media-library";
import { processImage, sha256Of } from "./process-image";
import { withImageSlot } from "./slot";
import { storeVariants, variantsComplete } from "./store";

/**
 * رفع صورة إلى المكتبة (docs/ADMIN_A3_SLIDER.md §6.1) بلا اعتماد على Next: البصمة أولًا، ثم المعالجة،
 * ثم الملفات والصف معًا تحت القفل.
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

/**
 * الصورة القائمة تُرجع بلا معالجة ما دامت ملفاتها كاملة؛ وإلا تُعالج وتُكتب ملفاتها من جديد (الصف لا
 * يتغير، C2). المعالجة في الخانة الوحيدة خارج القفل، والملفات والصف تحت قفل المحتوى (القرار 77).
 */
export async function uploadImage(db: Db, input: UploadInput): Promise<Result<Uploaded, string>> {
  const { root, clubId } = input;
  const hash = sha256Of(input.bytes);
  const known = await findAssetByHash(db, clubId, hash);
  if (known !== null && (await variantsComplete(root, clubId, hash, known.widths))) {
    return ok({ asset: known, existing: true });
  }
  const processed = await withImageSlot(() => processImage(input.bytes));
  if (processed === null) {
    return err("media.busy");
  }
  if (!processed.ok) {
    return err(processed.error);
  }
  const image = processed.value;
  const created = await createMediaAsset(
    db,
    {
      clubId,
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
    },
    async (existing) => {
      const widths = existing?.widths ?? image.widths;
      if (!(await variantsComplete(root, clubId, image.sha256, widths))) {
        await storeVariants(root, clubId, image.sha256, image.variants);
      }
    },
  );
  return ok(created);
}
