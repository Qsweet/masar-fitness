/**
 * قراءات «نظرة عامة» في اللوحة: كلها من القاعدة، و`now` يُمرَّر فالاختبار يثبّت الوقت. قراءات الفترة
 * بتقويم النادي في `overview-period.ts`. لا جوال كاملًا يخرج من هنا: آخر أربعة أرقام فقط.
 */
import { effectiveOrderStatus, lastMobileDigits, type OrderStatus } from "@masar/domain";
import type { Db } from "../client";

/** الطلبات المعلّقة التي لم تبلغ مهلتها: ما ينتظر الدفع الآن فعلًا. */
export function countAwaitingPayment(db: Db, clubId: string, now: Date): Promise<number> {
  return db.order.count({
    where: { clubId, status: "pending_payment", expiresAt: { gt: now } },
  });
}

export interface RecentOrder {
  readonly id: string;
  readonly reference: string;
  /** آخر أربعة أرقام من جوال العميل، للتعرّف لا للاتصال. */
  readonly phoneLast4: string;
  readonly itemNameAr: string;
  readonly itemNameEn: string;
  readonly totalMinor: number;
  readonly currency: string;
  /** الحالة كما تُعرض: المعلّق الذي بلغ مهلته منتهٍ. */
  readonly status: OrderStatus;
  readonly createdAt: Date;
}

const PHONE_TAIL = 4;

export async function listRecentOrders(
  db: Db,
  clubId: string,
  now: Date,
  limit: number,
): Promise<RecentOrder[]> {
  const rows = await db.order.findMany({
    where: { clubId, createdAt: { lte: now } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: { items: { where: { position: 0 }, select: { nameAr: true, nameEn: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    phoneLast4: lastMobileDigits(row.customerPhoneE164, PHONE_TAIL),
    itemNameAr: row.items[0]?.nameAr ?? "",
    itemNameEn: row.items[0]?.nameEn ?? "",
    totalMinor: row.totalMinor,
    currency: row.currency,
    status: effectiveOrderStatus(row.status, row.expiresAt, now),
    createdAt: row.createdAt,
  }));
}

export interface MfaCoverage {
  readonly active: number;
  readonly enrolled: number;
}

/** كم من الحسابات النشطة فعّل التحقق بخطوتين. */
export async function staffMfaCoverage(db: Db, clubId: string): Promise<MfaCoverage> {
  const where = { clubId, status: "active" } as const;
  const [active, enrolled] = await Promise.all([
    db.staffUser.count({ where }),
    db.staffUser.count({ where: { ...where, totpEnabledAt: { not: null } } }),
  ]);
  return { active, enrolled };
}
