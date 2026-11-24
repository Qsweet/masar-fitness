import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "./config/csp";
import { isSiteIndexable, NOINDEX_HEADER } from "./config/indexability";

const CSP_HEADER = "Content-Security-Policy";

/**
 * لكل طلب صفحة: سياسة أمان المحتوى بـnonce جديد، وإغلاق الفهرسة ما لم يُفتح الإعداد صراحةً.
 * الإعداد يُقرأ عند الطلب، فنفس البناء يُنشر مغلقًا على النطاق المؤقت ومفتوحًا على الرسمي.
 * توجيه اللغات ليس هنا: هو قواعد ثابتة في next.config.ts (القرار 8).
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  // Next يقرأ الـnonce من ترويسة السياسة في الطلب ويضعه على سكربتاته
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(CSP_HEADER, csp);
  if (!isSiteIndexable(process.env.SITE_INDEXABLE)) {
    response.headers.set(NOINDEX_HEADER.name, NOINDEX_HEADER.value);
  }
  return response;
}

export const config = {
  /*
   * كل المسارات عدا الواجهات وملفات Next الداخلية والملفات الثابتة المعروفة الامتداد.
   * الاستثناء بقائمة امتدادات محددة لا «أي مسار فيه نقطة»، حتى لا تفلت صفحة مثل ‎/blog/v1.2‎.
   */
  matcher: [
    "/((?!api/|_next/static/|_next/image|.*\\.(?:ico|png|jpg|jpeg|webp|avif|svg|gif|woff2|txt|xml|webmanifest)$).*)",
  ],
};
