/**
 * قائمة الطلبات في اللوحة (ADMIN_A2_SALES §6.1). التبويب بالحالة الفعلية (المعلّق الذي بلغ مهلته
 * منتهٍ)، والمدى على `created_at` بتقويم منطقة النادي، والبحث بالمرجع مطابقة تامة. القصّ هنا لا في
 * الواجهة: الجوال الكامل لا يخرج من هذا الملف.
 */
import {
  comparePlainDates,
  effectiveOrderStatus,
  formatPlainDate,
  maskSaudiMobile,
  money,
  plainDate,
  type LocalizedText,
  type Money,
  type OrderStatus,
  type PlainDate,
} from "@masar/domain";
import type { Db } from "../client";
import type { Prisma } from "../generated/prisma/client";

export const ORDER_LIST_TABS = ["all", "awaiting", "paid", "expired", "cancelled"] as const;
export type OrderListTab = (typeof ORDER_LIST_TABS)[number];

/** أرقام الجوال الظاهرة في اللوحة: للتعرّف لا للاتصال. */
export const ADMIN_VISIBLE_PHONE_DIGITS = 4;

export interface OrderListQuery {
  readonly clubId: string;
  readonly tab: OrderListTab;
  /** أول يوم وآخر يوم (مشمولان) بتقويم النادي؛ الغائب بلا حد. */
  readonly from?: PlainDate;
  readonly to?: PlainDate;
  /** مرجع مطبَّع (`parseOrderReference`): مطابقة تامة. */
  readonly reference?: string;
  readonly customerId?: string;
  /** تبدأ من 1. */
  readonly page: number;
  readonly pageSize: number;
  readonly now: Date;
}

export interface OrderListRow {
  readonly id: string;
  readonly reference: string;
  readonly createdAt: Date;
  /** الاسم كما خُتم على الطلب. */
  readonly customerName: string;
  /** آخر أربعة أرقام فقط ظاهرة. */
  readonly maskedPhone: string;
  /** السطر الأساسي (الأول) كما خُتم، وعدد السطور كلها. */
  readonly itemName: LocalizedText;
  readonly itemCount: number;
  readonly total: Money;
  /** الحالة كما تُعرض: المعلّق الذي بلغ مهلته منتهٍ. */
  readonly status: OrderStatus;
  readonly paidProvider: string | null;
  /** طريقة الدفعة اليدوية حين يكون الدفع يدويًا؛ وإلا null. */
  readonly manualMethod: string | null;
}

export interface OrderListPage {
  readonly rows: readonly OrderListRow[];
  readonly total: number;
}

function tabFilter(tab: OrderListTab, now: Date): Prisma.OrderWhereInput {
  switch (tab) {
    case "all":
      return {};
    case "awaiting":
      return { status: "pending_payment", expiresAt: { gt: now } };
    case "paid":
      return { status: { in: ["paid", "fulfilled"] } };
    case "expired":
      return {
        OR: [{ status: "expired" }, { status: "pending_payment", expiresAt: { lte: now } }],
      };
    case "cancelled":
      return { status: "cancelled" };
  }
}

/** حدّا المدى لحظتين (بداية اليوم الأول ونهاية الأخير في منطقة النادي)؛ null بلا حد. */
export interface OrderDayBounds {
  readonly starts: Date | null;
  readonly ends: Date | null;
}

type Bounds = OrderDayBounds;

/** أبعد ما يُستعلم عنه: لا طلب قبل المنصة ولا بعد قرن، وتاريخ خارج المدى لا يصل إلى حساب المنطقة. */
const MIN_RANGE_YEAR = 2000;
const MAX_RANGE_YEAR = 2100;
const DECEMBER = 12;
const LAST_DAY = 31;
const MIN_RANGE_DAY = plainDate(MIN_RANGE_YEAR, 1, 1);
const MAX_RANGE_DAY = plainDate(MAX_RANGE_YEAR, DECEMBER, LAST_DAY);

function clampDay(day: PlainDate): PlainDate {
  if (comparePlainDates(day, MIN_RANGE_DAY) < 0) {
    return MIN_RANGE_DAY;
  }
  return comparePlainDates(day, MAX_RANGE_DAY) > 0 ? MAX_RANGE_DAY : day;
}

/**
 * حدّا المدى لحظتين: بداية اليوم الأول ونهاية اليوم الأخير في منطقة النادي (القاعدة تحسبهما). اليوم
 * خارج المدى المعقول يُقصّ إليه: سنة 1 أو 9999 تُخرج لحظة لا يمثّلها Date فتُسقط الاستعلام.
 */
export async function dayBounds(
  db: Db,
  query: Pick<OrderListQuery, "clubId" | "from" | "to">,
): Promise<Bounds> {
  if (query.from === undefined && query.to === undefined) {
    return { starts: null, ends: null };
  }
  const from = query.from === undefined ? null : formatPlainDate(clampDay(query.from));
  const to = query.to === undefined ? null : formatPlainDate(clampDay(query.to));
  const rows = await db.$queryRaw<Bounds[]>`
    SELECT (${from}::date)::timestamp AT TIME ZONE c.timezone AS starts,
      ((${to}::date) + 1)::timestamp AT TIME ZONE c.timezone AS ends
    FROM clubs c WHERE c.id = ${query.clubId}::uuid`;
  return rows[0] ?? { starts: null, ends: null };
}

function rangeFilter(bounds: Bounds): Prisma.OrderWhereInput {
  if (bounds.starts === null && bounds.ends === null) {
    return {};
  }
  return {
    createdAt: {
      ...(bounds.starts === null ? {} : { gte: bounds.starts }),
      ...(bounds.ends === null ? {} : { lt: bounds.ends }),
    },
  };
}

const LIST_INCLUDE = {
  items: { where: { position: 0 }, select: { nameAr: true, nameEn: true } },
  _count: { select: { items: true } },
  manualPayment: { select: { method: true } },
} as const satisfies Prisma.OrderInclude;

type ListRow = Prisma.OrderGetPayload<{ include: typeof LIST_INCLUDE }>;

function toRow(row: ListRow, now: Date): OrderListRow {
  const first = row.items[0];
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.createdAt,
    customerName: row.customerName,
    maskedPhone: maskSaudiMobile(row.customerPhoneE164, ADMIN_VISIBLE_PHONE_DIGITS),
    itemName: { ar: first?.nameAr ?? "", en: first?.nameEn ?? "" },
    itemCount: row._count.items,
    total: money(row.totalMinor, row.currency),
    status: effectiveOrderStatus(row.status, row.expiresAt, now),
    paidProvider: row.paidProvider,
    manualMethod: row.manualPayment?.method ?? null,
  };
}

export async function listOrders(db: Db, query: OrderListQuery): Promise<OrderListPage> {
  return listOrdersWithin(db, query, await dayBounds(db, query));
}

/** القائمة بحدّي مدى محسوبين سلفًا (`listOrdersWithCounts` يحسبهما مرة للاثنين). */
export async function listOrdersWithin(
  db: Db,
  query: OrderListQuery,
  bounds: OrderDayBounds,
): Promise<OrderListPage> {
  const where: Prisma.OrderWhereInput = {
    clubId: query.clubId,
    ...tabFilter(query.tab, query.now),
    ...rangeFilter(bounds),
    ...(query.reference === undefined ? {} : { reference: query.reference }),
    ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
  };
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: LIST_INCLUDE,
    }),
    db.order.count({ where }),
  ]);
  return { rows: rows.map((row) => toRow(row, query.now)), total };
}
