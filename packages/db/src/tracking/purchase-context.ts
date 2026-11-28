/**
 * ما يحتاجه باني حمولة الشراء، يُقرأ عند الإرسال لا عند الإدراج (ADMIN_A5_TRACKING §4.1): الطلب
 * المدفوع وسطوره ومعرّف عميله وجواله، وما خُتم معه في `order_tracking`. الجوال لا يخرج من هنا إلا
 * إلى الباني الذي يجزّئه.
 */
import { decodeTouch, type Touch } from "./touch";
import type { Db } from "../client";

export interface PurchaseItem {
  readonly slug: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly totalMinor: number;
}

export interface PurchaseContext {
  readonly orderId: string;
  readonly reference: string;
  readonly customerId: string;
  readonly phoneE164: string;
  readonly locale: string;
  readonly totalMinor: number;
  readonly currency: string;
  readonly paidAt: Date;
  readonly items: readonly PurchaseItem[];
  readonly consentAnalytics: boolean;
  readonly consentAds: boolean;
  readonly lastTouch: Touch | null;
  readonly firstTouch: Touch | null;
  readonly gaClientId: string | null;
  readonly fbp: string | null;
  readonly fbc: string | null;
  readonly scid: string | null;
  readonly ttp: string | null;
  /** مرجع متصفح OpenAI (`__obref`)، القرار 93. */
  readonly obref: string | null;
  /** كوكي `__oppref` المختوم مع الطلب (مراجعة القرار 93). */
  readonly opprefCookie: string | null;
  readonly clientIp: string | null;
  readonly userAgent: string | null;
  readonly pageUrl: string | null;
  /** وقت تفريغ المعرّفات بعد مدة الاحتفاظ (القرار 90-6)، أو null. */
  readonly purgedAt: Date | null;
}

interface Row {
  readonly id: string;
  readonly reference: string;
  readonly customer_id: string;
  readonly customer_phone_e164: string;
  readonly locale: string;
  readonly total_minor: number;
  readonly currency: string;
  readonly paid_at: Date | null;
  readonly consent_analytics: boolean | null;
  readonly consent_ads: boolean | null;
  readonly first_touch: unknown;
  readonly last_touch: unknown;
  readonly ga_client_id: string | null;
  readonly fbp: string | null;
  readonly fbc: string | null;
  readonly scid: string | null;
  readonly ttp: string | null;
  readonly obref: string | null;
  readonly oppref: string | null;
  readonly client_ip: string | null;
  readonly user_agent: string | null;
  readonly page_url: string | null;
  readonly purged_at: Date | null;
}

async function loadItems(db: Db, orderId: string): Promise<PurchaseItem[]> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    orderBy: { position: "asc" },
    select: { productSlug: true, nameAr: true, nameEn: true, totalMinor: true },
  });
  return items.map((item) => ({
    slug: item.productSlug,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    totalMinor: item.totalMinor,
  }));
}

type TrackedRow = Row & {
  readonly paid_at: Date;
  readonly consent_analytics: boolean;
  readonly consent_ads: boolean;
};

function isTracked(row: Row | undefined): row is TrackedRow {
  if (row === undefined) {
    return false;
  }
  return row.paid_at !== null && row.consent_analytics !== null && row.consent_ads !== null;
}

/** null لطلب غير موجود أو غير مدفوع أو بلا سطر قياس (لا موافقة مختومة ⇒ لا إرسال). */
export async function loadPurchaseContext(
  db: Db,
  orderId: string,
): Promise<PurchaseContext | null> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT o.id::text, o.reference, o.customer_id::text, o.customer_phone_e164, o.locale,
      o.total_minor, o.currency, o.paid_at, t.consent_analytics, t.consent_ads, t.first_touch,
      t.last_touch, t.ga_client_id, t.fbp, t.fbc, t.scid, t.ttp, t.obref, t.oppref, t.client_ip,
      t.user_agent, t.page_url, t.purged_at
    FROM orders o LEFT JOIN order_tracking t ON t.order_id = o.id
    WHERE o.id = ${orderId}::uuid`;
  const row = rows[0];
  if (!isTracked(row)) {
    return null;
  }
  return {
    orderId: row.id,
    reference: row.reference,
    customerId: row.customer_id,
    phoneE164: row.customer_phone_e164,
    locale: row.locale,
    totalMinor: row.total_minor,
    currency: row.currency,
    paidAt: row.paid_at,
    items: await loadItems(db, row.id),
    consentAnalytics: row.consent_analytics,
    consentAds: row.consent_ads,
    firstTouch: decodeTouch(row.first_touch),
    lastTouch: decodeTouch(row.last_touch),
    gaClientId: row.ga_client_id,
    fbp: row.fbp,
    fbc: row.fbc,
    scid: row.scid,
    ttp: row.ttp,
    obref: row.obref,
    opprefCookie: row.oppref,
    clientIp: row.client_ip,
    userAgent: row.user_agent,
    pageUrl: row.page_url,
    purgedAt: row.purged_at,
  };
}
