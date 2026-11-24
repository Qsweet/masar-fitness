import "server-only";
import { logger } from "../logger";
import { isServerFault, problemFromError, problemResponse } from "./problem";

type RouteHandler<Context> = (request: Request, context: Context) => Promise<Response>;

/**
 * يغلّف كل معالج واجهة: لا استثناء يصل للعميل خامًا.
 * الأعطال الداخلية تُسجَّل كاملة مع requestId؛ أخطاء العمل المتوقعة لا تُسجَّل كأعطال.
 */
export function withErrorHandling<Context>(handler: RouteHandler<Context>): RouteHandler<Context> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      const requestId = crypto.randomUUID();
      const problem = problemFromError(error, requestId);
      if (isServerFault(problem)) {
        logger.error("http.unhandled_error", {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          error,
        });
      }
      return problemResponse(problem);
    }
  };
}
