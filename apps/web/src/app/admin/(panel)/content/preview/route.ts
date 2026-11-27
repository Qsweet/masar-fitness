import { NextResponse, type NextRequest } from "next/server";
import { notFound } from "next/navigation";
import {
  previewCookie,
  previewDestination,
  previewTarget,
  SEE_OTHER,
  siteUrl,
} from "@/server/admin/content/preview-route";
import { requireStaff } from "@/server/admin/guard";

/**
 * يبدأ معاينة المسودة أو إصدار (‎?target=draft|<معرّف>&path=…&locale=…‎): يضع كوكي المعاينة المختوم
 * ثم يحوّل إلى الصفحة العامة. لمن يملك `content.read` بجلسة كاملة؛ هدف ليس لنادي الموظف ⇒ 404.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await requireStaff("content.read");
  const query = request.nextUrl.searchParams;
  const target = (await previewTarget(context, query.get("target"))) ?? notFound();
  const response = NextResponse.redirect(
    siteUrl(previewDestination(query.get("path"), query.get("locale"))),
    SEE_OTHER,
  );
  const cookie = previewCookie(context, target, new Date());
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
