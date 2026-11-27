import "server-only";
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { ADMIN_ROUTES, mediaAssetPath } from "@/config/admin";
import { MAX_UPLOAD_BYTES, UPLOAD_FORM_OVERHEAD_BYTES } from "@/config/media-library";
import { getDb } from "../db";
import { getEnv } from "../env";
import { logger } from "../logger";
import { allowMediaUpload } from "../admin/throttle";
import type { StaffContext } from "../admin/session";
import { uploadImage } from "./upload";

/**
 * طلب الرفع من نموذج المكتبة (docs/ADMIN_A3_SLIDER.md §6.1): Route Handler لا Server Action (حد 1MB).
 * الحارس قبله في `route.ts`. الرفع مطفأ ⇒ 404. الأصل غير أصل الموقع ⇒ 403 (لا فحص Origin تلقائي هنا).
 * الحجم يُفحص من الترويسة قبل قراءة الجسم. النتيجة تحويل إلى المكتبة برسالة، فالنموذج يعمل بلا JavaScript.
 */
const SEE_OTHER = 303;
const FORBIDDEN = 403;

function back(path: string, query: Record<string, string>): NextResponse {
  const url = new URL(path, getEnv().SITE_URL);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, SEE_OTHER);
}

function refuse(reason: string): NextResponse {
  return back(ADMIN_ROUTES.contentMedia, { error: reason });
}

/** الطلب من صفحة الموقع نفسه وبحجم مقبول؟ null للمقبول، وإلا الرد. */
export function preflight(request: Request): NextResponse | null {
  if (request.headers.get("origin") !== new URL(getEnv().SITE_URL).origin) {
    return new NextResponse(null, { status: FORBIDDEN });
  }
  const length = Number(request.headers.get("content-length") ?? "");
  if (!Number.isFinite(length) || length <= 0) {
    return refuse("media.no_file");
  }
  if (length > MAX_UPLOAD_BYTES + UPLOAD_FORM_OVERHEAD_BYTES) {
    return refuse("media.too_large");
  }
  return null;
}

async function fileOf(request: Request): Promise<File | null> {
  try {
    const file = (await request.formData()).get("file");
    return file instanceof File && file.size > 0 ? file : null;
  } catch {
    return null;
  }
}

export async function handleUpload(request: Request, context: StaffContext): Promise<NextResponse> {
  const { MEDIA_DIR, MEDIA_UPLOADS } = getEnv();
  if (!MEDIA_UPLOADS || MEDIA_DIR === null) {
    notFound();
  }
  const refused = preflight(request);
  if (refused !== null) {
    return refused;
  }
  if (!allowMediaUpload(context.staff.id)) {
    return refuse("media.rate_limited");
  }
  const file = await fileOf(request);
  if (file === null) {
    return refuse("media.no_file");
  }
  try {
    const uploaded = await uploadImage(getDb(), {
      root: MEDIA_DIR,
      clubId: context.staff.clubId,
      staffId: context.staff.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      now: new Date(),
    });
    if (!uploaded.ok) {
      return refuse(uploaded.error);
    }
    const done = uploaded.value.existing ? "media_asset_exists" : "media_asset_uploaded";
    return back(mediaAssetPath(uploaded.value.asset.id), { done });
  } catch (error) {
    logger.error("media.upload_failed", { error });
    return refuse("media.store_failed");
  }
}
