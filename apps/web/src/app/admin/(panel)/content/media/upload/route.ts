import type { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/server/admin/guard";
import { handleUpload } from "@/server/media/upload-route";

/**
 * ‎POST /admin/content/media/upload‎: رفع صورة إلى المكتبة من نموذج multipart (يعمل بلا JavaScript).
 * لمن يملك `content.write` بجلسة كاملة؛ المنطق في server/media/upload-route.ts.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await requireStaff("content.write");
  return handleUpload(request, context);
}
