import "server-only";
import { findAssetByHash } from "@masar/db";
import { hasPermission, liveSlides, type SliderState } from "@masar/domain";
import { MEDIA_FILE_SHAPE, MEDIA_HASH_SHAPE, type MediaFormat } from "@/config/media-library";
import { getDb } from "../db";
import { getEnv } from "../env";
import { isAdminEnabled } from "../admin/flag";
import { currentStaffSession } from "../admin/session";
import { publishedSlider } from "../content/site-content";
import { readVariant } from "./store";

/**
 * خدمة نسخ الصور (docs/ADMIN_A3_SLIDER.md §6.2، القرار 77): للعامة صور الشرائح السارية الآن في الإصدار
 * المنشور، بتخزين سنة ثابت (الملف لا يتغير تحت بصمته)، من ذاكرة قارئ المحتوى بلا استعلام لكل صورة؛ وللموظف بجلسة كاملة و`content.read` صور ناديه كلها بلا تخزين (المكتبة
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

/**
 * صور الشرائح السارية الآن في الإصدار المنشور: وحدها تُخدَّم للعامة. صورة شريحة مخفية أو مجدولة أو
 * منتهية لا تُرى من خارج اللوحة (والمجدولة تظهر في وقتها بلا نشر).
 */
export function liveImageHashes(slider: SliderState, now: Date): ReadonlySet<string> {
  return new Set(
    liveSlides(slider.slides, now).flatMap((slide) =>
      slide.mobile === null ? [slide.desktop.hash] : [slide.desktop.hash, slide.mobile.hash],
    ),
  );
}

/** نادي الصورة وسياسة تخزينها لمن طلبها، أو null (لا تُخدَّم له). العامة أولًا: بلا قراءة جلسة. */
async function access(hash: string, now: Date): Promise<{ clubId: string; cache: string } | null> {
  // استعلام صغير واحد (آخر إصدار)، واللقطة المحلَّلة من ذاكرة القارئ بمعرّف الإصدار
  const site = await publishedSlider();
  if (site.clubId !== null && liveImageHashes(site.slider, now).has(hash)) {
    return { clubId: site.clubId, cache: PUBLIC_CACHE };
  }
  const current = isAdminEnabled() ? await currentStaffSession() : null;
  if (current?.stage !== "full" || !hasPermission(current.staff.role, "content.read")) {
    return null;
  }
  const own = await findAssetByHash(getDb(), current.staff.clubId, hash);
  return own === null ? null : { clubId: current.staff.clubId, cache: PRIVATE_CACHE };
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
  const allowed = await access(request.hash, new Date());
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
