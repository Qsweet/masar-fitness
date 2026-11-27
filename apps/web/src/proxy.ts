import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_OPEN_HEADER,
  ADMIN_OPEN_VALUE,
  isAdminConfigured,
  isAdminPath,
  NO_STORE_HEADER,
  PREVIEW_COOKIE_NAMES,
  PREVIEW_NO_STORE_HEADER,
} from "./config/admin";
import { buildCsp, paymentFormActionOrigins } from "./config/csp";
import { isSiteIndexable, NOINDEX_HEADER } from "./config/indexability";
import { EMPTY_CSP_EXTENSION, trackingCsp, type CspExtension } from "./config/tracking-csp";
import { captureAttribution } from "./server/tracking/attribution-cookie";
import { enabledProviders, siteTracking, TRACKING_HEADER } from "./server/tracking/site-config";

const CSP_HEADER = "Content-Security-Policy";

/**
 * لكل طلب صفحة: سياسة أمان المحتوى بـnonce جديد، وإغلاق الفهرسة ما لم يُفتح الإعداد صراحةً.
 * الإعداد يُقرأ عند الطلب، فنفس البناء يُنشر مغلقًا على النطاق المؤقت ومفتوحًا على الرسمي.
 * توجيه اللغات ليس هنا: هو قواعد ثابتة في next.config.ts (القرار 8).
 */
const HTTP_BAD_REQUEST = 400;
/** رابط بترميز نسبة مئوية فاسد (مثل ‎%E0%A4%A‎) لا يُفك: يُرفض هنا بـ400 بدل أن يُسقط التوجيه بخطأ 500. */
function isMalformedPath(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

/**
 * منصات القياس المفعّلة لصفحات الموقع وحدها (اللوحة بلا وسوم): مضيفاتها في CSP، وأسماؤها في ترويسة
 * طلب داخلية تقرؤها الصفحة فلا ترسم وسمًا لم تفتحه السياسة نفسها (ADMIN_A5_TRACKING §6).
 */
async function trackingFor(pathname: string): Promise<{ csp: CspExtension; names: string }> {
  if (isAdminPath(pathname)) {
    return { csp: EMPTY_CSP_EXTENSION, names: "" };
  }
  const providers = enabledProviders(await siteTracking());
  return { csp: trackingCsp(providers), names: providers.join(",") };
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (isMalformedPath(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: HTTP_BAD_REQUEST });
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const tracking = await trackingFor(request.nextUrl.pathname);
  const csp = buildCsp(
    nonce,
    process.env.NODE_ENV === "development",
    paymentFormActionOrigins(process.env),
    tracking.csp,
  );

  // Next يقرأ الـnonce من ترويسة السياسة في الطلب ويضعه على سكربتاته
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, csp);
  // ما يرسله العميل بهذا الاسم يُحذف دائمًا: الوسيط وحده يقرر أن اللوحة مفتوحة
  requestHeaders.delete(ADMIN_OPEN_HEADER);
  requestHeaders.set(TRACKING_HEADER, tracking.names);
  const openAdmin = isOpenAdminPath(request.nextUrl.pathname);
  if (openAdmin) {
    requestHeaders.set(ADMIN_OPEN_HEADER, ADMIN_OPEN_VALUE);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CSP_HEADER, csp);
  // كوكي المعاينة (صحيحًا كان أو لا): الرد قد يحمل مسودة، فلا يُخزَّن في أي ذاكرة ولا يُفهرس
  const previewing = PREVIEW_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (previewing) {
    response.headers.set(PREVIEW_NO_STORE_HEADER.name, PREVIEW_NO_STORE_HEADER.value);
  }
  if (openAdmin) {
    response.headers.set(NO_STORE_HEADER.name, NO_STORE_HEADER.value);
  }
  if (previewing || openAdmin || !isSiteIndexable(process.env.SITE_INDEXABLE)) {
    response.headers.set(NOINDEX_HEADER.name, NOINDEX_HEADER.value);
  }
  if (!isAdminPath(request.nextUrl.pathname)) {
    captureAttribution(request, response, tracking.names !== "");
  }
  return response;
}

/**
 * مسار لوحة مضبوطة بصيغته الحرفية (‎/admin‎ بحروف صغيرة وبلا ترميز): يُعلَّم الطلب بترويسة داخلية،
 * ولا يُخزَّن رده ولا يُفهرس أبدًا. كل ما عداه (لوحة بلا `ADMIN_SECRET_KEY`، أو ‎/Admin‎ أو ‎/%61dmin‎)
 * لا يُعلَّم، فقاعدة next.config تخدّمه من اللغة الافتراضية كأي مسار مجهول: صفحة «غير موجودة» العامة
 * بحالة 404، بالجسم والترويسات نفسها، فلا يُعرف من الرد أن اللوحة موجودة. الوسيط لا يعيد الكتابة
 * بنفسه: إعادة كتابته تضيف ترويسة ‎x-middleware-rewrite‎ إلى الرد فتميّزه.
 */
function isOpenAdminPath(pathname: string): boolean {
  return isAdminPath(pathname) && isAdminConfigured(process.env.ADMIN_SECRET_KEY);
}

export const config = {
  /*
   * كل المسارات عدا الواجهات وملفات Next الداخلية. لا استثناء بالامتداد:
   * الاستثناء بلاحقة المسار كان يُخرج أي صفحة HTML ينتهي رابطها بامتداد بلا سياسة أمان ولا منع فهرسة.
   */
  matcher: ["/((?!api/|_next/static/|_next/image).*)"],
};
