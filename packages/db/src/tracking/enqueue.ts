/**
 * إدراج تحويل الشراء في الطابور داخل معاملة التسوية (ADMIN_A5_TRACKING §4.1). جملة SQL واحدة بلا
 * اتصال خارجي: سطر لكل منصة خادمية مفعّلة لها مفتاح، ووافق صاحب الطلب على فئتها. القيد الفريد على
 * الحدث الحي يجعل الإعادة بلا أثر.
 */
import { purchaseEventId } from "@masar/domain";
import type { Tx } from "../commerce/transaction";

export const PURCHASE_EVENT = "purchase";

export interface EnqueuePurchaseInput {
  readonly orderId: string;
  readonly clubId: string;
  /** وقت الدفع: هو `event_time` عند كل منصة. */
  readonly paidAt: Date;
}

/** عدد السطور المدرجة (صفر بلا تكامل أو بلا موافقة أو في الإعادة). */
export async function enqueuePurchaseConversions(
  tx: Tx,
  input: EnqueuePurchaseInput,
): Promise<number> {
  return tx.$executeRaw`
    INSERT INTO tracking_outbox (id, club_id, order_id, provider, event_name, event_id, kind, status,
      attempts, next_attempt_at, event_time, created_at, updated_at)
    SELECT gen_random_uuid(), ti.club_id, ${input.orderId}::uuid, ti.provider, ${PURCHASE_EVENT},
      ${purchaseEventId(input.orderId)}, 'live', 'pending', 0, ${input.paidAt}, ${input.paidAt},
      ${input.paidAt}, ${input.paidAt}
    FROM tracking_integrations ti
    JOIN order_tracking ot ON ot.order_id = ${input.orderId}::uuid AND ot.club_id = ti.club_id
    WHERE ti.club_id = ${input.clubId}::uuid AND ti.enabled AND ti.secret_enc IS NOT NULL
      AND ti.provider IN ('ga4', 'meta', 'snap', 'tiktok', 'openai')
      AND CASE WHEN ti.provider = 'ga4' THEN ot.consent_analytics ELSE ot.consent_ads END
    ON CONFLICT (club_id, provider, event_name, event_id) WHERE kind = 'live' DO NOTHING`;
}
