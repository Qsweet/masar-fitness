import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  MEDIA_FORMATS,
  MEDIA_HASH_SHAPE,
  variantFileName,
  type MediaFormat,
} from "@/config/media-library";
import type { Variant } from "./process-image";

/**
 * ملفات المكتبة على القرص (docs/ADMIN_A3_SLIDER.md §6.1، القرار 77): `<MEDIA_DIR>/<club_id>/<sha256>/`.
 * كل ملف يُكتب ويُزامَن (fsync) في مجلد مؤقت بجانب الهدف، ثم يُزامَن المجلد، ثم `rename` ذري للمجلد كله
 * ويُزامَن الأب؛ فلا يرى قارئ نسخًا ناقصة، ولا يبقى بعد انقطاع الكهرباء مجلد باسمه وملفات فارغة.
 * الاستبدال (إصلاح أصل ناقص الملفات) ينقل القديم جانبًا ثم يضع الجديد ثم يحذف القديم. المسارات من
 * معرّفات مفحوصة الشكل وحدها.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function clubDir(root: string, clubId: string): string {
  if (!UUID_SHAPE.test(clubId)) {
    throw new Error("media.path_invalid");
  }
  return join(root, clubId);
}

function assetDir(root: string, clubId: string, hash: string): string {
  if (!MEDIA_HASH_SHAPE.test(hash)) {
    throw new Error("media.path_invalid");
  }
  return join(clubDir(root, clubId), hash);
}

function errorCode(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

async function syncPath(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeSynced(path: string, data: Buffer): Promise<void> {
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** هل لكل عرض ملفا AVIF وWebP بحجم غير صفري؟ */
export async function variantsComplete(
  root: string,
  clubId: string,
  hash: string,
  widths: readonly number[],
): Promise<boolean> {
  const dir = assetDir(root, clubId, hash);
  const files = widths.flatMap((width) =>
    MEDIA_FORMATS.map((format) => join(dir, variantFileName(width, format))),
  );
  const sizes = await Promise.all(
    files.map((file) =>
      stat(file).then(
        (info) => info.size,
        () => 0,
      ),
    ),
  );
  return sizes.every((size) => size > 0);
}

async function writeTemp(root: string, clubId: string, variants: readonly Variant[]) {
  const temp = join(clubDir(root, clubId), `.tmp-${randomUUID()}`);
  await mkdir(temp, { recursive: true });
  try {
    for (const variant of variants) {
      await writeSynced(join(temp, variantFileName(variant.width, variant.format)), variant.data);
    }
    await syncPath(temp);
    return temp;
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}

/**
 * يضع النسخ في مكانها بخطوة واحدة، مستبدلًا أي مجلد قائم بالبصمة نفسها (يستدعيه الرفع تحت قفل المحتوى
 * حين تنقص ملفات الأصل أو لا توجد).
 */
export async function storeVariants(
  root: string,
  clubId: string,
  hash: string,
  variants: readonly Variant[],
): Promise<void> {
  const target = assetDir(root, clubId, hash);
  const temp = await writeTemp(root, clubId, variants);
  const old = join(clubDir(root, clubId), `.old-${randomUUID()}`);
  try {
    await rename(target, old).catch((error: unknown) => {
      if (errorCode(error) !== "ENOENT") {
        throw error;
      }
    });
    await rename(temp, target);
    await syncPath(clubDir(root, clubId));
  } finally {
    await rm(temp, { recursive: true, force: true });
    await rm(old, { recursive: true, force: true });
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
    if (errorCode(error) === "ENOENT") {
      return null;
    }
    throw error;
  }
}
