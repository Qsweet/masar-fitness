import { withErrorHandling } from "@/server/http/handle";
import { serveMedia } from "@/server/media/serve";

export const dynamic = "force-dynamic";

/**
 * ‎GET /api/media/<بصمة>/w<عرض>.<avif|webp>‎: نسخ صور المكتبة. المنطق كله في server/media/serve.ts.
 * تحت ‎api/‎ فلا يمر بالوسيط ولا بإعادة كتابة اللغة.
 */
export const GET = withErrorHandling(
  async (_request: Request, context: RouteContext<"/api/media/[hash]/[file]">) => {
    const { hash, file } = await context.params;
    return serveMedia(hash, file);
  },
);
