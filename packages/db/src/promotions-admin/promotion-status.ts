/**
 * انتقالات العرض (ADMIN_A2_SALES §5): تفعيل، إيقاف مؤقت، إنهاء. `checkPromotion` يرفض كل ما ليس
 * `active`، فالإيقاف والإنهاء يسريان على أول طلب تالٍ؛ الطلب المعلّق الذي يحمل الخصم يبقى بلقطته.
 */
import {
  decidePromotionStatus,
  endsAtWhenEnded,
  ok,
  type DomainError,
  type PromotionStatus,
  type PromotionStatusAction,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { lockPromotionForEdit, nextUpdatedAt, type PromotionAuditAction } from "./write-promotion";

export interface SetPromotionStatusInput {
  readonly promotionId: string;
  readonly clubId: string;
  readonly lockToken: string;
  readonly action: PromotionStatusAction;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface PromotionStatusResult {
  readonly status: PromotionStatus;
  readonly replayed: boolean;
}

const AUDIT_ACTION: Readonly<Record<PromotionStatusAction, PromotionAuditAction>> = {
  activate: "promotion_activated",
  pause: "promotion_paused",
  end: "promotion_ended",
};

async function setInTransaction(
  tx: Tx,
  input: SetPromotionStatusInput,
): Promise<Result<PromotionStatusResult, DomainError>> {
  const locked = await lockPromotionForEdit(tx, input);
  if (!locked.ok) {
    return locked;
  }
  const { rule, updatedAt } = locked.value;
  const decision = decidePromotionStatus(rule.status, input.action);
  if (!decision.ok) {
    return decision;
  }
  const { to, replay } = decision.value;
  if (replay) {
    return ok({ status: to, replayed: true });
  }
  const endsAt = input.action === "end" ? endsAtWhenEnded(rule, input.now) : rule.endsAt;
  await tx.promotion.update({
    where: { id: rule.id },
    data: { status: to, endsAt, updatedAt: nextUpdatedAt(updatedAt, input.now) },
  });
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: "promotion",
    entityId: rule.id,
    action: AUDIT_ACTION[input.action],
    fromState: rule.status,
    toState: to,
    actor: input.actor,
    data: { code: rule.code },
    at: input.now,
  });
  return ok({ status: to, replayed: false });
}

export function setPromotionStatus(
  db: Db,
  input: SetPromotionStatusInput,
): Promise<Result<PromotionStatusResult, DomainError>> {
  return inTransaction(db, (tx) => setInTransaction(tx, input));
}
