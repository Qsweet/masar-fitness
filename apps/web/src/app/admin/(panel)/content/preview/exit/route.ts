import { NextResponse } from "next/server";
import { ADMIN_ROUTES } from "@/config/admin";
import { clearedPreviewCookie, SEE_OTHER, siteUrl } from "@/server/admin/content/preview-route";
import { requireStaff } from "@/server/admin/guard";

/** ينهي المعاينة: يمحو الكوكي ويعود إلى حالة المحتوى في اللوحة. */
export async function GET(): Promise<NextResponse> {
  await requireStaff("content.read");
  const response = NextResponse.redirect(siteUrl(ADMIN_ROUTES.content), SEE_OTHER);
  const cookie = clearedPreviewCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
