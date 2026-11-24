import "server-only";
import { findMembershipPlan, listMembershipPlans } from "@masar/db";
import type { MembershipPlan } from "@masar/domain";
import { getDb } from "./db";

/** الباقات المعروضة للبيع لحظة الطلب: السعر دائمًا من القاعدة، لا من الواجهة. */
export function getMembershipPlans(): Promise<MembershipPlan[]> {
  return listMembershipPlans(getDb(), new Date());
}

export function getMembershipPlan(slug: string): Promise<MembershipPlan | undefined> {
  return findMembershipPlan(getDb(), slug, new Date());
}
