import { withErrorHandling } from "@/server/http/handle";
import { handleWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

/**
 * ‎POST /api/payments/webhooks/[provider]‎: إشعارات مزوّد الدفع المضبوط (مثل ‎…/webhooks/moyasar‎).
 * بلا لغة ولا كاش. المنطق كله في server/payments/webhook.ts.
 */
export const POST = withErrorHandling(
  async (request: Request, context: RouteContext<"/api/payments/webhooks/[provider]">) => {
    const { provider } = await context.params;
    return handleWebhook(request, provider);
  },
);
