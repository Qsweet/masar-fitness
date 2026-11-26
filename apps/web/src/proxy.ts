import { NextResponse, type NextRequest } from "next/server";
import { isAdminConfigured, isAdminPath, NO_STORE_HEADER } from "./config/admin";
import { buildCsp, paymentFormActionOrigins } from "./config/csp";
import { isSiteIndexable, NOINDEX_HEADER } from "./config/indexability";

const CSP_HEADER = "Content-Security-Policy";

/**
 * لكل طلب صفحة: سياسة أمان المحتوى بـnonce جديد، وإغلاق الفهرسة ما لم يُفتح الإعداد صراحةً.
 * الإعداد يُقرأ عند الطلب، فنفس البناء يُنشر مغلقًا على النطاق المؤقت ومفتوحًا على الرسمي.
 * توجيه اللغات ليس هنا: هو قواعد ثابتة في next.config.ts (القرار 8).
 */
const HTTP_BAD_REQUEST = 400;
/**
 * مسار لا صفحة له: قواعد next.config تخدّمه من اللغة الافتراضية، فيطابق ‎[locale]/[...rest]‎ ويعرض
 * «غير موجودة» العامة بحالة 404. بلا بادئة لغة: الوجهة ‎/ar/…‎ تمر بتحويل البادئة الدائم لا بالصفحة.
 */
const ADMIN_CLOSED_PATH = "/admin-closed";

/** رابط بترميز نسبة مئوية فاسد (مثل ‎%E0%A4%A‎) لا يُفك: يُرفض هنا بـ400 بدل أن يُسقط التوجيه بخطأ 500. */
function isMalformedPath(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest): NextResponse {
  if (isMalformedPath(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: HTTP_BAD_REQUEST });
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(
    nonce,
    process.env.NODE_ENV === "development",
    paymentFormActionOrigins(process.env),
  );

  // Next يقرأ الـnonce من ترويسة السياسة في الطلب ويضعه على سكربتاته
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, csp);
  const { pathname } = request.nextUrl;
  const response = isAdminPath(pathname)
    ? adminResponse(request, requestHeaders)
    : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CSP_HEADER, csp);
  if (isOpenAdminPath(pathname) || !isSiteIndexable(process.env.SITE_INDEXABLE)) {
    response.headers.set(NOINDEX_HEADER.name, NOINDEX_HEADER.value);
  }
  return response;
}

/** مسار داخل لوحة مضبوطة: يُمنع فهرسته دائمًا، حتى على النطاق المفهرس. */
function isOpenAdminPath(pathname: string): boolean {
  return isAdminPath(pathname) && isAdminConfigured(process.env.ADMIN_SECRET_KEY);
}

/**
 * مسارات اللوحة: بلا `ADMIN_SECRET_KEY` تُخدَّم صفحة «غير موجودة» العامة نفسها (404) كأي مسار مجهول،
 * فلا يُعرف حتى أن اللوحة موجودة (ولا ترويسة تميّزها عن أي 404 آخر). ومعه: لا تخزين لأي رد، ومنع
 * الفهرسة يُضاف دائمًا في `proxy`.
 */
function adminResponse(request: NextRequest, requestHeaders: Headers): NextResponse {
  if (!isAdminConfigured(process.env.ADMIN_SECRET_KEY)) {
    const closed = new URL(ADMIN_CLOSED_PATH, request.url);
    return NextResponse.rewrite(closed, { request: { headers: requestHeaders } });
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(NO_STORE_HEADER.name, NO_STORE_HEADER.value);
  return response;
}

export const config = {
  /*
   * كل المسارات عدا الواجهات وملفات Next الداخلية. لا استثناء بالامتداد:
   * الاستثناء بلاحقة المسار كان يُخرج أي صفحة HTML ينتهي رابطها بامتداد بلا سياسة أمان ولا منع فهرسة.
   */
  matcher: ["/((?!api/|_next/static/|_next/image).*)"],
};
