import "server-only";
import { listMembershipPlans } from "@masar/db";
import type { MembershipPlan } from "@masar/domain";
import { cache } from "react";
import { getDb } from "./db";
import { logger } from "./logger";

/** عطل في قراءة الكتالوج. رسالته عامة عمدًا: خطأ القاعدة الأصلي يُسجَّل منقّحًا ولا يُرمى. */
export class CatalogUnavailableError extends Error {
  constructor() {
    super("catalog.unavailable");
    this.name = "CatalogUnavailableError";
  }
}

async function loadMembershipPlans(): Promise<MembershipPlan[]> {
  try {
    return await listMembershipPlans(getDb(), new Date());
  } catch (error) {
    // خطأ Prisma الخام يحمل قيم الاستعلام؛ لو تُرك لطبعه Next كما هو خارج السجل المنظَّم
    logger.error("catalog.read_failed", { error });
    throw new CatalogUnavailableError();
  }
}

/**
 * الباقات المعروضة للبيع لحظة الطلب: السعر دائمًا من القاعدة، لا من الواجهة.
 * `cache` يجعلها استعلامًا واحدًا ولحظة واحدة لكل طلب، مهما تعدد المستدعون (الصفحة وبياناتها الوصفية).
 */
export const getMembershipPlans = cache(loadMembershipPlans);

/** الباقة بمعرّفها النصي من القائمة المحمَّلة: نص الزائر لا يصل إلى القاعدة أبدًا. */
export async function getMembershipPlan(slug: string): Promise<MembershipPlan | undefined> {
  return (await getMembershipPlans()).find((plan) => plan.slug === slug);
}
