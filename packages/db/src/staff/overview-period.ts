/**
 * قراءات «نظرة عامة» v2 لفترة (ADMIN_REDESIGN §5.1): سلسلة يومية بتقويم النادي، والمبيعات حسب
 * الاشتراك، وقمع الطلب إلى الدفع. حدود الفترة لحظتان يحسبهما المجال (`parseRange`)، فلا `NOW()` هنا،
 * والاختبار يثبّت الوقت. كل استعلام محصور بنادٍ ومدى على فهرس: (club_id, created_at) للإنشاء،
 * و(club_id, paid_at) للدفع. المبالغ بالهللة أعدادًا صحيحة.
 */
import type { Db } from "../client";

export interface PeriodWindow {
  /** أول يوم وآخر يوم بتقويم النادي (‎YYYY-MM-DD‎). */
  readonly from: string;
  readonly to: string;
  readonly start: Date;
  /** نهاية غير مشمولة (الآن، حين تنتهي الفترة اليوم). */
  readonly end: Date;
}

export interface PeriodDay {
  readonly day: string;
  /** ما دُفع في اليوم (بيوم الدفع) بالهللة. */
  readonly revenueMinor: number;
  /** طلبات دُفعت في اليوم. */
  readonly paid: number;
  /** طلبات أُنشئت في اليوم. */
  readonly created: number;
  /** منها ما دُفع (في أي وقت حتى نهاية الفترة): بسط نسبة الإتمام. */
  readonly createdPaid: number;
}

interface PeriodDayRow {
  readonly day: string;
  readonly revenue: bigint;
  readonly paid: number;
  readonly created: number;
  readonly created_paid: number;
}

/** كل يوم في الفترة حاضر ولو بلا طلبات، الأقدم أولًا. */
export async function periodDailySeries(
  db: Db,
  clubId: string,
  timezone: string,
  window: PeriodWindow,
): Promise<PeriodDay[]> {
  const rows = await db.$queryRaw<PeriodDayRow[]>`
    WITH days AS (
      SELECT generate_series(${window.from}::date, ${window.to}::date, interval '1 day')::date AS day
    ), paid AS (
      SELECT (o.paid_at AT TIME ZONE ${timezone})::date AS day,
        count(*)::int AS paid, sum(o.paid_amount_minor)::bigint AS revenue
      FROM orders o
      WHERE o.club_id = ${clubId}::uuid
        AND o.paid_at >= ${window.start}::timestamptz AND o.paid_at < ${window.end}::timestamptz
      GROUP BY 1
    ), created AS (
      SELECT (o.created_at AT TIME ZONE ${timezone})::date AS day, count(*)::int AS created,
        (count(*) FILTER (WHERE o.paid_at IS NOT NULL AND o.paid_at < ${window.end}::timestamptz))::int
          AS created_paid
      FROM orders o
      WHERE o.club_id = ${clubId}::uuid
        AND o.created_at >= ${window.start}::timestamptz AND o.created_at < ${window.end}::timestamptz
      GROUP BY 1
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
      coalesce(p.revenue, 0)::bigint AS revenue, coalesce(p.paid, 0)::int AS paid,
      coalesce(c.created, 0)::int AS created, coalesce(c.created_paid, 0)::int AS created_paid
    FROM days d LEFT JOIN paid p USING (day) LEFT JOIN created c USING (day)
    ORDER BY d.day`;
  return rows.map((row) => ({
    day: row.day,
    revenueMinor: Number(row.revenue),
    paid: row.paid,
    created: row.created,
    createdPaid: row.created_paid,
  }));
}

export interface PlanSales {
  readonly productId: string;
  readonly nameAr: string;
  readonly nameEn: string;
  /** طلبات مدفوعة في الفترة هذا الاشتراك سطرها الأول. */
  readonly orders: number;
  readonly revenueMinor: number;
}

interface PlanSalesRow {
  readonly product_id: string;
  readonly name_ar: string;
  readonly name_en: string;
  readonly orders: number;
  readonly revenue: bigint;
}

/**
 * المدفوع في الفترة (بيوم الدفع) مجمَّعًا بالسطر الأول من الطلب (الاشتراك أو البرنامج)، والاسم من
 * أحدث طلب. الأكبر مبلغًا أولًا.
 */
export async function periodSalesByPlan(
  db: Db,
  clubId: string,
  window: Pick<PeriodWindow, "start" | "end">,
): Promise<PlanSales[]> {
  const rows = await db.$queryRaw<PlanSalesRow[]>`
    SELECT i.product_id::text AS product_id,
      (array_agg(i.name_ar ORDER BY o.paid_at DESC))[1] AS name_ar,
      (array_agg(i.name_en ORDER BY o.paid_at DESC))[1] AS name_en,
      count(*)::int AS orders, sum(o.paid_amount_minor)::bigint AS revenue
    FROM orders o JOIN order_items i ON i.order_id = o.id AND i.position = 0
    WHERE o.club_id = ${clubId}::uuid
      AND o.paid_at >= ${window.start}::timestamptz AND o.paid_at < ${window.end}::timestamptz
    GROUP BY i.product_id
    ORDER BY revenue DESC, orders DESC`;
  return rows.map((row) => ({
    productId: row.product_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    orders: row.orders,
    revenueMinor: Number(row.revenue),
  }));
}

export interface FunnelRow {
  readonly created: number;
  readonly attempted: number;
  readonly paid: number;
  readonly failed: number;
  readonly expired: number;
}

/**
 * قمع الطلبات المنشأة في الفترة كما كان عند نهايتها: كم بدأت لها محاولة دفع قبل النهاية (أو دُفعت
 * يدويًا بلا محاولة)، وكم دُفعت قبلها، وسبب فقد ما بدأ ولم يُدفع: محاولة فاشلة، أو مهلة انقضت قبل
 * النهاية. لا يُقرأ وضع الطلب الحالي، فلفترة ماضية الأرقام نفسها مهما حدث بعدها.
 */
export async function periodFunnel(
  db: Db,
  clubId: string,
  window: Pick<PeriodWindow, "start" | "end">,
): Promise<FunnelRow> {
  const [row] = await db.$queryRaw<FunnelRow[]>`
    WITH cohort AS (
      SELECT o.expires_at,
        (o.paid_at IS NOT NULL AND o.paid_at < ${window.end}::timestamptz) AS is_paid,
        EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_id = o.id
          AND a.created_at < ${window.end}::timestamptz) AS has_attempt,
        EXISTS (SELECT 1 FROM payment_attempts a WHERE a.order_id = o.id AND a.status = 'failed'
          AND a.created_at < ${window.end}::timestamptz) AS has_failure
      FROM orders o
      WHERE o.club_id = ${clubId}::uuid
        AND o.created_at >= ${window.start}::timestamptz AND o.created_at < ${window.end}::timestamptz
    )
    SELECT count(*)::int AS created,
      (count(*) FILTER (WHERE is_paid OR has_attempt))::int AS attempted,
      (count(*) FILTER (WHERE is_paid))::int AS paid,
      (count(*) FILTER (WHERE NOT is_paid AND has_attempt AND has_failure))::int AS failed,
      (count(*) FILTER (WHERE NOT is_paid AND has_attempt AND NOT has_failure
        AND expires_at <= ${window.end}::timestamptz))::int AS expired
    FROM cohort`;
  return row ?? { created: 0, attempted: 0, paid: 0, failed: 0, expired: 0 };
}

/** هل للنادي طلب واحد على الأقل منذ بدأ؟ يفصل «قبل البيع» عن «مع البيانات». */
export async function clubHasOrders(db: Db, clubId: string): Promise<boolean> {
  const first = await db.order.findFirst({ where: { clubId }, select: { id: true } });
  return first !== null;
}
