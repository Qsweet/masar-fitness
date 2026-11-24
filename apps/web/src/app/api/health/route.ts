import { isDbReachable } from "@masar/db";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { withErrorHandling } from "@/server/http/handle";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * نقطة الصحة للمراقبة والنشر: 200 إن كانت القاعدة تجيب، وإلا 503.
 * لا تكشف إلا الحالة والإصدار.
 */
export const GET = withErrorHandling(async () => {
  const { APP_VERSION } = getEnv();
  const dbUp = await isDbReachable(getDb());
  if (!dbUp) {
    logger.error("health.db_unreachable");
  }
  return Response.json(
    { status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down", version: APP_VERSION },
    {
      status: dbUp ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE,
      headers: { "Cache-Control": "no-store", "X-App-Version": APP_VERSION },
    },
  );
});
