import "server-only";
import {
  claimBrowserPurchase,
  loadPurchaseContext,
  type OrderView,
  type PurchaseContext,
} from "@masar/db";
import { majorNumber, phoneE164ForHash, purchaseEventId } from "@masar/domain";
import { createHash } from "node:crypto";
import type { TrackPayload } from "@/components/tracking/types";
import { getDb } from "../db";
import { logger } from "../logger";
import { pageTracking } from "./page-tracking";
import { browserShare, type BrowserShare } from "./browser-share";

const SETTLED = new Set(["paid", "fulfilled"]);

interface BrowserIdentifiers {
  readonly sha256Phone?: string;
  readonly twclid?: string;
}

const NONE: BrowserIdentifiers = {};

/**
 * المعرّفات التي يجوز نشرها في هذا العرض (`browserShare`)، وإلا لا شيء. «أول عرض» يُستهلك آخرًا،
 * وطلب فُرِّغت معرّفاته بعد مدة الاحتفاظ لا ينشر شيئًا (القرار 90-6).
 */
async function browserIdentifiers(orderId: string): Promise<BrowserIdentifiers> {
  const tracking = await pageTracking();
  if (tracking === null) {
    return NONE;
  }
  const context = await loadPurchaseContext(getDb(), orderId);
  if (context?.purgedAt !== null) {
    return NONE;
  }
  const share = browserShare({
    requestAds: tracking.consent?.ads === true,
    orderAds: context.consentAds,
    providers: tracking.providers,
  });
  const found = identifiersOf(context, share);
  if (Object.keys(found).length === 0) {
    return NONE;
  }
  return (await claimBrowserPurchase(getDb(), orderId, new Date())) ? found : NONE;
}

/** ما يُنشر إن سمح به `browserShare` ووُجد مع الطلب. */
function identifiersOf(context: PurchaseContext, share: BrowserShare): BrowserIdentifiers {
  const e164 = share.phone ? phoneE164ForHash(context.phoneE164) : null;
  const twclid = share.twclid ? twclidOf(context) : undefined;
  return {
    ...(e164 === null ? {} : { sha256Phone: createHash("sha256").update(e164).digest("hex") }),
    ...(twclid === undefined ? {} : { twclid }),
  };
}

/** معرّف نقر X من آخر لمسة ثم الأولى، كما يأخذ الباني الخادمي معرّفات المنصات الأخرى. */
function twclidOf(context: PurchaseContext): string | undefined {
  return context.lastTouch?.values.twclid ?? context.firstTouch?.values.twclid;
}

/**
 * نسخة المتصفح من الشراء (ADMIN_A5_TRACKING §2.2): فقط لطلب حالته في القاعدة مدفوع، بمعرّف الخادم
 * نفسه (`purchase.<order_id>`). الجوال مجزّأً (E.164) ومعرّف نقر X لا يُكتبان في الصفحة إلا بشروط
 * `browserShare` وفي أول عرض للطلب وحده (القرار 89-1): الرابط يُعاد إرساله، والتجزئة تُعكس بتجربة
 * الأرقام. null لطلب غير مدفوع.
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
    return { ...base, ...(await browserIdentifiers(order.id)) };
  } catch (error) {
    logger.error("tracking.purchase_context_failed", { error });
    return base;
  }
}
