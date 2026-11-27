import "server-only";
import { findAssetByHash, isPublishedAsset, oldestClubId } from "@masar/db";
import { hasPermission } from "@masar/domain";
import { MEDIA_FILE_SHAPE, MEDIA_HASH_SHAPE, type MediaFormat } from "@/config/media-library";
import { getDb } from "../db";
import { getEnv } from "../env";
import { isAdminEnabled } from "../admin/flag";
import { currentStaffSession } from "../admin/session";
import { readVariant } from "./store";

/**
 * خدمة نسخ الصور (docs/ADMIN_A3_SLIDER.md §6.2): للعامة ما في آخر إصدار منشور لنادي الموقع، بتخزين سنة
 * ثابت (الملف لا يتغير تحت بصمته)؛ وللموظف بجلسة كاملة و`content.read` صور ناديه كلها بلا تخزين (المكتبة
 * والمعاينة). غير ذلك 404، وصورة لم تُنشر لا تُرى من خارج اللوحة.
 */
const PUBLIC_CACHE = "public, max-age=31536000, immutable";
const PRIVATE_CACHE = "private, no-store";
const NOT_FOUND = 404;
const TYPES: Readonly<Record<MediaFormat, string>> = { avif: "image/avif", webp: "image/webp" };

export interface MediaRequest {
  readonly hash: string;
  readonly width: number;
  readonly format: MediaFormat;
}

/** المعاملان بشكلهما الحرفي، أو null: لا مقطع `..` ولا امتداد آخر يصل إلى القرص. */
export function parseMediaRequest(hash: string, file: string): MediaRequest | null {
  const match = MEDIA_FILE_SHAPE.exec(file);
  if (!MEDIA_HASH_SHAPE.test(hash) || match === null) {
    return null;
  }
  const format = match[2] === "avif" ? "avif" : "webp";
  return { hash, width: Number(match[1]), format };
}

let siteClub: string | null = null;

async function siteClubId(): Promise<string | null> {
  siteClub ??= await oldestClubId(getDb());
  return siteClub;
}

/** نادي الصورة وسياسة تخزينها لمن طلبها، أو null (لا تُخدَّم له). */
async function access(hash: string): Promise<{ clubId: string; cache: string } | null> {
  const current = isAdminEnabled() ? await currentStaffSession() : null;
  if (current?.stage === "full" && hasPermission(current.staff.role, "content.read")) {
    const own = await findAssetByHash(getDb(), current.staff.clubId, hash);
    if (own !== null) {
      return { clubId: current.staff.clubId, cache: PRIVATE_CACHE };
    }
  }
  const club = await siteClubId();
  return club !== null && (await isPublishedAsset(getDb(), club, hash))
    ? { clubId: club, cache: PUBLIC_CACHE }
    : null;
}

function notFoundResponse(): Response {
  return new Response(null, {
    status: NOT_FOUND,
    headers: { "Cache-Control": PRIVATE_CACHE, "X-Content-Type-Options": "nosniff" },
  });
}

export async function serveMedia(hash: string, file: string): Promise<Response> {
  const request = parseMediaRequest(hash, file);
  const root = getEnv().MEDIA_DIR;
  if (request === null || root === null) {
    return notFoundResponse();
  }
  const allowed = await access(request.hash);
  const data =
    allowed === null
      ? null
      : await readVariant(root, allowed.clubId, request.hash, request.width, request.format);
  if (allowed === null || data === null) {
    return notFoundResponse();
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": TYPES[request.format],
      "Content-Length": String(data.byteLength),
      "Cache-Control": allowed.cache,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
