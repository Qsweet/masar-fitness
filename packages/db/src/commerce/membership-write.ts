/**
 * الخطوة 5 من `markOrderPaid`: اشتراك سطر الاشتراك المختوم. قفل صف العميل يسلسل فحص الاشتراك الحي،
 * فلا يُفعَّل اشتراكان متراكبان لطلبين مدفوعين متزامنين.
 */
import { randomUUID } from "node:crypto";
import {
  DomainError,
  decideMembershipStart,
  formatPlainDate,
  plainDateInZone,
  type MembershipStartDecision,
} from "@masar/domain";
import { writeAudit } from "./audit";
import { hasLiveMembership } from "./load-customer";
import { lockCustomer } from "./locks";
import type { Tx } from "./transaction";

export interface PaidOrderRef {
  readonly id: string;
  readonly club_id: string;
  readonly customer_id: string;
}

async function findMembershipItem(tx: Tx, orderId: string) {
  const item = await tx.orderItem.findFirst({
    where: { orderId, kind: "membership" },
    select: { id: true, durationMonths: true, bonusMonths: true, membershipStartRule: true },
  });
  if (item === null) {
    return undefined;
  }
  // CHECK السطر يضمن المدة والقاعدة لسطر الاشتراك؛ غيابهما عطل بيانات
  if (item.durationMonths === null || item.membershipStartRule === null) {
    throw new DomainError("invariant", "order_item.membership_terms_missing");
  }
  return { ...item, paidMonths: item.durationMonths, startRule: item.membershipStartRule };
}

async function decide(
  tx: Tx,
  order: PaidOrderRef,
  item: NonNullable<Awaited<ReturnType<typeof findMembershipItem>>>,
  now: Date,
): Promise<MembershipStartDecision> {
  await lockCustomer(tx, order.customer_id);
  const club = await tx.club.findUniqueOrThrow({
    where: { id: order.club_id },
    select: { timezone: true },
  });
  const paidOn = plainDateInZone(now, club.timezone);
  return decideMembershipStart({
    rule: item.startRule,
    paidOn,
    hasLiveMembership: await hasLiveMembership(tx, order.customer_id, paidOn),
    paidMonths: item.paidMonths,
    bonusMonths: item.bonusMonths,
  });
}

/** ينشئ اشتراك الطلب إن كان فيه سطر اشتراك، ويرجع معرّفه أو null. التواريخ نصوص YYYY-MM-DD. */
export async function createMembershipForOrder(
  tx: Tx,
  order: PaidOrderRef,
  now: Date,
): Promise<string | null> {
  const item = await findMembershipItem(tx, order.id);
  if (item === undefined) {
    return null;
  }
  const decision = await decide(tx, order, item, now);
  const startsOn = decision.status === "active" ? formatPlainDate(decision.startsOn) : null;
  const endsOn = decision.status === "active" ? formatPlainDate(decision.endsOn) : null;
  const id = randomUUID();
  await tx.$executeRaw`
    INSERT INTO memberships (id, club_id, customer_id, order_id, order_item_id, order_paid_at,
      paid_months, bonus_months, start_rule, status, starts_on, ends_on, created_at, updated_at)
    VALUES (${id}::uuid, ${order.club_id}::uuid, ${order.customer_id}::uuid, ${order.id}::uuid,
      ${item.id}::uuid, ${now}, ${item.paidMonths}, ${item.bonusMonths},
      ${item.startRule}::membership_start_rule, ${decision.status}::membership_status,
      ${startsOn}::date, ${endsOn}::date, ${now}, ${now})`;
  await writeAudit(tx, {
    clubId: order.club_id,
    entityType: "membership",
    entityId: id,
    action: "membership_created",
    fromState: null,
    toState: decision.status,
    actor: "system",
    data: {
      orderId: order.id,
      startsOn,
      endsOn,
      reason: decision.status === "scheduled" ? decision.reason : null,
    },
    at: now,
  });
  return id;
}
