import { NextResponse } from "next/server";
import { isSiteIndexable, NOINDEX_HEADER } from "./config/indexability";

/**
 * يغلق الفهرسة على كل الصفحات ما لم يُفتح الإعداد صراحةً. يُقرأ الإعداد عند الطلب،
 * فنفس البناء يُنشر مغلقًا على النطاق المؤقت ومفتوحًا على الرسمي.
 * توجيه اللغات ليس هنا: هو قواعد ثابتة في next.config.ts (انظر docs/DECISIONS.md، القرار 8).
 */
export function proxy(): NextResponse {
  const response = NextResponse.next();
  if (!isSiteIndexable(process.env.SITE_INDEXABLE)) {
    response.headers.set(NOINDEX_HEADER.name, NOINDEX_HEADER.value);
  }
  return response;
}

export const config = {
  // كل الصفحات، عدا الواجهات والملفات الداخلية وأي ملف له امتداد (صور، robots.txt، ...)
  matcher: ["/((?!api/|_next/|.*\\.[\\w]+$).*)"],
};
