/**
 * تفريغ معرّفات القياس بعد مدة الاحتفاظ (القرار 90-6، ADMIN_A5_TRACKING §7.1). دفعات صغيرة متكررة
 * بـ`SKIP LOCKED`، والإعادة لا تغيّر شيئًا (ما فُرِّغ له `purged_at`). الـtrigger لا يقبل من التحديث إلا
 * هذا الانتقال بعينه، فلا يُعدَّل بهذا المسار غير المعرّفات.
 */
import { retentionCutoff } from "@masar/domain";
import type { Db } from "../client";

export const PURGE_REASON = "retention_purged";

export interface PurgeOptions {
  readonly now: Date;
  readonly batchSize: number;
  /** حد الدفعات في التشغيل الواحد: الباقي للدورة التالية. */
  readonly maxBatches: number;
}

export interface PurgeSummary {
  readonly orders: number;
  readonly outbox: number;
}

/** دفعة واحدة من `order_tracking`: عدد ما فُرِّغ. الطلب أقدم من الحد بوقت إنشائه هو. */
async function purgeOrderBatch(db: Db, cutoff: Date, limit: number, now: Date): Promise<number> {
  return db.$executeRaw`
    UPDATE order_tracking SET ga_client_id = NULL, fbp = NULL, fbc = NULL, scid = NULL, ttp = NULL,
      client_ip = NULL, user_agent = NULL, page_url = NULL,
      first_touch = tracking_scrub_touch(first_touch), last_touch = tracking_scrub_touch(last_touch),
      purged_at = ${now}
    WHERE order_id IN (
      SELECT ot.order_id FROM order_tracking ot JOIN orders o ON o.id = ot.order_id
      WHERE ot.purged_at IS NULL AND ot.created_at < ${cutoff} AND o.created_at < ${cutoff}
      ORDER BY ot.created_at LIMIT ${limit} FOR UPDATE OF ot SKIP LOCKED)`;
}

/**
 * الطابور لا يحمل حمولة ولا جسم رد أصلًا (القرار 88-7)؛ ما بقي معلّقًا من العمر نفسه يُغلق بسببه فلا
 * يُبنى من طلب فُرِّغ، والسطر يبقى سجلًّا بالحالة والرمز وحدهما.
 */
async function closeStaleOutbox(db: Db, cutoff: Date, now: Date): Promise<number> {
  return db.$executeRaw`
    UPDATE tracking_outbox SET status = 'dead', last_reason = ${PURGE_REASON}, claim_token = NULL,
      updated_at = ${now}
    WHERE status = 'pending' AND created_at < ${cutoff}`;
}

export async function purgeExpiredTracking(db: Db, options: PurgeOptions): Promise<PurgeSummary> {
  const cutoff = retentionCutoff(options.now);
  let orders = 0;
  for (let batch = 0; batch < options.maxBatches; batch += 1) {
    const purged = await purgeOrderBatch(db, cutoff, options.batchSize, options.now);
    orders += purged;
    if (purged < options.batchSize) {
      break;
    }
  }
  return { orders, outbox: await closeStaleOutbox(db, cutoff, options.now) };
}
