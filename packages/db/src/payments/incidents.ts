/**
 * حوادث الدفع (الشرط الصلب 4): سجل للإلحاق ينبّه الإدارة. لا تفعيل ولا استرداد آلي بحادثة،
 * ومعالجتها (استرداد من لوحة المزوّد أم تفعيل يدوي) قرار المالك.
 */
import { randomUUID } from "node:crypto";
import type { IncidentKind, IncidentNote } from "@masar/domain";
import type { Prisma } from "../generated/prisma/client";
import { assertNoPersonalData } from "../commerce/audit";
import type { Tx } from "../commerce/transaction";

export interface IncidentTarget {
  readonly clubId: string;
  readonly orderId: string;
  readonly attemptId: string;
}

/**
 * يفتح حادثة إن لم تكن مفتوحة من قبل للمحاولة نفسها بالنوع نفسه (`UNIQUE(attempt_id, kind)`).
 * يرجع true إن فُتحت الآن، فيُكتب سطر التنبيه مرة واحدة لا مع كل مطابقة.
 */
export async function openIncident(
  tx: Tx,
  target: IncidentTarget,
  note: IncidentNote,
  now: Date,
): Promise<boolean> {
  assertNoPersonalData(note.data);
  const data: Prisma.InputJsonObject = { ...note.data };
  const inserted = await tx.$executeRaw`
    INSERT INTO payment_incidents (id, club_id, order_id, attempt_id, kind, data, opened_at)
    VALUES (${randomUUID()}::uuid, ${target.clubId}::uuid, ${target.orderId}::uuid,
      ${target.attemptId}::uuid, ${note.kind}, ${data}::jsonb, ${now})
    ON CONFLICT (attempt_id, kind) DO NOTHING`;
  return inserted === 1;
}

/** يفتح عدة حوادث ويرجع أنواع ما فُتح منها الآن. */
export async function openIncidents(
  tx: Tx,
  target: IncidentTarget,
  notes: readonly IncidentNote[],
  now: Date,
): Promise<IncidentKind[]> {
  const opened: IncidentKind[] = [];
  for (const note of notes) {
    if (await openIncident(tx, target, note, now)) {
      opened.push(note.kind);
    }
  }
  return opened;
}
