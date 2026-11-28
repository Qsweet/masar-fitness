/**
 * ما يُختم مع الطلب للقياس (ADMIN_A5_TRACKING §5.2): الموافقة لحظة الطلب، واللمستان، ومعرّفات
 * المتصفح التي سمحت بها الموافقة. إدراج واحد بلا تحديث (trigger)، والضغطة الثانية لا تغيّر شيئًا.
 */
import type { Touch } from "@masar/domain";
import type { Db } from "../client";

export interface OrderTrackingInput {
  readonly orderId: string;
  readonly consent: {
    readonly analytics: boolean;
    readonly ads: boolean;
    readonly version: number | null;
    readonly at: Date | null;
  };
  readonly firstTouch: Touch | null;
  readonly lastTouch: Touch | null;
  readonly gaClientId: string | null;
  readonly fbp: string | null;
  readonly fbc: string | null;
  readonly scid: string | null;
  readonly ttp: string | null;
  readonly obref: string | null;
  /** كوكي `__oppref` (مراجعة القرار 91)، بديل `oppref` الرابط حين يخالف نمط معرّفات النقر. */
  readonly oppref: string | null;
  readonly clientIp: string | null;
  readonly userAgent: string | null;
  readonly pageUrl: string | null;
  readonly now: Date;
}

function json(touch: Touch | null): string | null {
  return touch === null ? null : JSON.stringify(touch);
}

/** يرجع true إن أُدرج السطر الآن، وfalse إن كان موجودًا (إعادة الطلب نفسه) أو لا طلب بالمعرّف. */
export async function recordOrderTracking(db: Db, input: OrderTrackingInput): Promise<boolean> {
  const inserted = await db.$executeRaw`
    INSERT INTO order_tracking (order_id, club_id, consent_analytics, consent_ads, consent_version,
      consent_at, first_touch, last_touch, ga_client_id, fbp, fbc, scid, ttp, obref, oppref,
      client_ip, user_agent, page_url, created_at)
    SELECT id, club_id, ${input.consent.analytics}, ${input.consent.ads}, ${input.consent.version},
      ${input.consent.at}, ${json(input.firstTouch)}::jsonb, ${json(input.lastTouch)}::jsonb,
      ${input.gaClientId}, ${input.fbp}, ${input.fbc}, ${input.scid}, ${input.ttp},
      ${input.obref}, ${input.oppref}, ${input.clientIp}, ${input.userAgent}, ${input.pageUrl}, ${input.now}
    FROM orders WHERE id = ${input.orderId}::uuid
    ON CONFLICT (order_id) DO NOTHING`;
  return inserted === 1;
}
