import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MEDIA_HASH_SHAPE, variantFileName, type MediaFormat } from "@/config/media-library";
import type { Variant } from "./process-image";

/**
 * ملفات المكتبة على القرص (docs/ADMIN_A3_SLIDER.md §6.1): `<MEDIA_DIR>/<club_id>/<sha256>/w<عرض>.<صيغة>`.
 * الكتابة إلى مجلد مؤقت بجانب الهدف ثم `rename` ذري للمجلد كله، فلا يرى قارئ نسخًا ناقصة أبدًا؛ ومجلد
 * قائم بالبصمة نفسها (رفع متزامن) يبقى ويُحذف المؤقت. المسارات من معرّفات مفحوصة الشكل وحدها.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function assetDir(root: string, clubId: string, hash: string): string {
  if (!UUID_SHAPE.test(clubId) || !MEDIA_HASH_SHAPE.test(hash)) {
    throw new Error("media.path_invalid");
  }
  return join(root, clubId, hash);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isTaken(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOTEMPTY" || error.code === "EEXIST")
  );
}

/** يكتب النسخ كلها ثم ينقلها إلى مكانها بخطوة واحدة. true إن كُتبت الآن، false إن وُجدت من قبل. */
export async function storeVariants(
  root: string,
  clubId: string,
  hash: string,
  variants: readonly Variant[],
): Promise<boolean> {
  const target = assetDir(root, clubId, hash);
  const temp = join(root, clubId, `.tmp-${randomUUID()}`);
  await mkdir(temp, { recursive: true });
  try {
    for (const variant of variants) {
      await writeFile(join(temp, variantFileName(variant.width, variant.format)), variant.data);
    }
    await rename(temp, target);
    return true;
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    if (isTaken(error)) {
      return false;
    }
    throw error;
  }
}

export async function removeAssetFiles(root: string, clubId: string, hash: string): Promise<void> {
  await rm(assetDir(root, clubId, hash), { recursive: true, force: true });
}

/** بايتات نسخة، أو null إن لم توجد. */
export async function readVariant(
  root: string,
  clubId: string,
  hash: string,
  width: number,
  format: MediaFormat,
): Promise<Buffer | null> {
  try {
    return await readFile(join(assetDir(root, clubId, hash), variantFileName(width, format)));
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
}
