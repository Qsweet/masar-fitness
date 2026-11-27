import "server-only";
import { loadPurchaseContext, type OrderView } from "@masar/db";
import { majorNumber, phoneE164ForHash, purchaseEventId } from "@masar/domain";
import { createHash } from "node:crypto";
import type { TrackPayload } from "@/components/tracking/types";
import { getDb } from "../db";
import { logger } from "../logger";

const SETTLED = new Set(["paid", "fulfilled"]);

/**
 * نسخة المتصفح من الشراء (ADMIN_A5_TRACKING §2.2): فقط لطلب حالته في القاعدة مدفوع، بمعرّف الخادم
 * نفسه (`purchase.<order_id>`). الجوال مجزّأً (E.164 لجوجل وتيك توك) فقط إن وافق صاحب الطلب على
 * الإعلانات حين طلب. null لطلب غير مدفوع.
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
    const context = await loadPurchaseContext(getDb(), order.id);
    const e164 = context?.consentAds === true ? phoneE164ForHash(context.phoneE164) : null;
    return e164 === null
      ? base
      : { ...base, sha256Phone: createHash("sha256").update(e164).digest("hex") };
  } catch (error) {
    logger.error("tracking.purchase_context_failed", { error });
    return base;
  }
}
