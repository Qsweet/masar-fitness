import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_OPEN_HEADER,
  ADMIN_OPEN_VALUE,
  isAdminConfigured,
  isAdminPath,
  NO_STORE_HEADER,
} from "./config/admin";
import { buildCsp, paymentFormActionOrigins } from "./config/csp";
import { isSiteIndexable, NOINDEX_HEADER } from "./config/indexability";

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
  // ما يرسله العميل بهذا الاسم يُحذف دائمًا: الوسيط وحده يقرر أن اللوحة مفتوحة
  requestHeaders.delete(ADMIN_OPEN_HEADER);
  const openAdmin = isOpenAdminPath(request.nextUrl.pathname);
  if (openAdmin) {
    requestHeaders.set(ADMIN_OPEN_HEADER, ADMIN_OPEN_VALUE);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CSP_HEADER, csp);
  if (openAdmin) {
    response.headers.set(NO_STORE_HEADER.name, NO_STORE_HEADER.value);
  }
  if (openAdmin || !isSiteIndexable(process.env.SITE_INDEXABLE)) {
    response.headers.set(NOINDEX_HEADER.name, NOINDEX_HEADER.value);
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
