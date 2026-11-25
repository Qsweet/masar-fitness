/** حقائق العميل التي تُقرأ تحت قفل صفه: المكانة، والطلبات المعلّقة، والاشتراك الحي. */
import { isLiveMembership, plainDate, type PlainDate } from "@masar/domain";
import type { Tx } from "./transaction";

/** «عميل قائم» = له طلب مدفوع على المنصة. يُحسب هنا وحده ويُمرَّر إلى التسعير. */
export async function loadStanding(client: Tx, customerId: string): Promise<"new" | "existing"> {
  const paid = await client.order.findFirst({
    where: { customerId, paidAt: { not: null } },
    select: { id: true },
  });
  return paid === null ? "new" : "existing";
}

/** الطلبات المعلّقة فعلًا (لم تبلغ مهلتها)، بتعريف `effectiveOrderStatus`. */
export function countPendingOrders(client: Tx, customerId: string, now: Date): Promise<number> {
  return client.order.count({
    where: { customerId, status: "pending_payment", expiresAt: { gt: now } },
  });
}

/** عمود DATE يصل من Prisma منتصف ليل UTC، فأجزاؤه بتوقيت UTC هي التاريخ التقويمي نفسه. */
export function plainDateFromColumn(value: Date): PlainDate {
  return plainDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

/** هل للعميل اشتراك حي اليوم؟ بتعريف `isLiveMembership` (مجدول أو مجمَّد أو نشط لم يبلغ نهايته). */
export async function hasLiveMembership(
  client: Tx,
  customerId: string,
  today: PlainDate,
): Promise<boolean> {
  const rows = await client.membership.findMany({
    where: { customerId, status: { in: ["scheduled", "active", "frozen"] } },
    select: { status: true, endsOn: true },
  });
  return rows.some((row) =>
    isLiveMembership(
      { status: row.status, endsOn: row.endsOn === null ? null : plainDateFromColumn(row.endsOn) },
      today,
    ),
  );
}
