import type { Tx } from "../commerce/transaction";

/**
 * قفل محتوى النادي (نمط S1): كتابة المسودة والنشر والاسترجاع والتجاهل تتسلسل عليه، فالنشر يلتقط مسودة
 * لا تتغير تحته، والإصدار يأخذ رقمًا تاليًا بلا تكرار. يتحرر عند نهاية المعاملة.
 */
export async function lockContent(tx: Tx, clubId: string): Promise<void> {
  const key = `content:${clubId}`;
  // ‏`::text` لأن pg_advisory_xact_lock ترجع void، ومحوّل Prisma لا يقرأ عمود void
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))::text AS locked`;
}
