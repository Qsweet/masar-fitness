import "server-only";
import { claimBrowserPurchase, loadPurchaseContext, type OrderView } from "@masar/db";
import { majorNumber, phoneE164ForHash, purchaseEventId } from "@masar/domain";
import { createHash } from "node:crypto";
import type { TrackPayload } from "@/components/tracking/types";
import { getDb } from "../db";
import { logger } from "../logger";
import { pageTracking } from "./page-tracking";
import { mayShareHashedPhone } from "./phone-share";

const SETTLED = new Set(["paid", "fulfilled"]);

/** الجوال E.164 إن جاز نشره مجزّأً في هذا العرض، وإلا null. «أول عرض» يُستهلك آخرًا. */
async function shareablePhone(orderId: string): Promise<string | null> {
  const tracking = await pageTracking();
  if (tracking === null) {
    return null;
  }
  const context = await loadPurchaseContext(getDb(), orderId);
  const allowed = mayShareHashedPhone({
    requestAds: tracking.consent?.ads === true,
    orderAds: context?.consentAds === true,
    providers: tracking.providers,
  });
  if (!allowed || context === null || !(await claimBrowserPurchase(getDb(), orderId, new Date()))) {
    return null;
  }
  return phoneE164ForHash(context.phoneE164);
}

/**
 * نسخة المتصفح من الشراء (ADMIN_A5_TRACKING §2.2): فقط لطلب حالته في القاعدة مدفوع، بمعرّف الخادم
 * نفسه (`purchase.<order_id>`). الجوال مجزّأً (E.164) لا يُكتب في الصفحة إلا بشروط `mayShareHashedPhone`
 * وفي أول عرض للطلب وحده (القرار 89-1): الرابط يُعاد إرساله، والتجزئة تُعكس بتجربة الأرقام. null لطلب
 * غير مدفوع.
 */
export async function purchasePayload(
  order: OrderView,
  locale: "ar" | "en",
): Promise<TrackPayload | null> {
  if (!SETTLED.has(order.status)) {
    return null;
  }
  const lines = order.items.map((item) => ({
    id: item.slug,
    name: item.name[locale],
    price: majorNumber(item.total.amountMinor),
  }));
  const base = {
    eventId: purchaseEventId(order.id),
    transactionId: order.reference,
    value: majorNumber(order.total.amountMinor),
    currency: order.total.currency,
    lines,
  };
  try {
    const e164 = await shareablePhone(order.id);
    return e164 === null
      ? base
      : { ...base, sha256Phone: createHash("sha256").update(e164).digest("hex") };
  } catch (error) {
    logger.error("tracking.purchase_context_failed", { error });
    return base;
  }
}
