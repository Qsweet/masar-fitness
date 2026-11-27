/**
 * أول عرض لصفحة الطلب المدفوع يحمل الجوال المجزّأ إلى المتصفح (القرار 89-1): مرة واحدة لكل طلب،
 * فالرابط المُعاد إرساله لا يكشف التجزئة. إدراج ذري: true للعرض الأول وحده.
 */
import type { Db } from "../client";

export async function claimBrowserPurchase(db: Db, orderId: string, now: Date): Promise<boolean> {
  const inserted = await db.$executeRaw`
    INSERT INTO tracking_browser_purchases (order_id, created_at)
    SELECT id, ${now} FROM orders WHERE id = ${orderId}::uuid
    ON CONFLICT (order_id) DO NOTHING`;
  return inserted === 1;
}
