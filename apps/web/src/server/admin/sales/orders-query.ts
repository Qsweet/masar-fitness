import { ORDER_LIST_TABS, type OrderListTab } from "@masar/db";
import {
  addDays,
  comparePlainDates,
  formatPlainDate,
  parseOrderReference,
  parsePlainDate,
  type PlainDate,
} from "@masar/domain";
import { z } from "zod";
import { ADMIN_ROUTES, ORDERS_DEFAULT_RANGE_DAYS } from "@/config/admin";

/**
 * تصفية قائمة الطلبات من الرابط (نموذج GET): التبويب، والمدى الزمني بتقويم النادي، والمرجع، والصفحة.
 * منطق صرف يُختبر بلا Next. المخطط للشكل والأطوال فقط؛ معنى المرجع والتاريخ في المجال.
 */
const MAX_PAGE = 10_000;
const DATE_INPUT_LENGTH = 10;
/** لا طلب قبل المنصة ولا بعد قرن. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const REFERENCE_INPUT_LENGTH = 24;

const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .optional()
    .catch(undefined);

const querySchema = z.object({
  tab: z.enum(ORDER_LIST_TABS).catch("all"),
  from: text(DATE_INPUT_LENGTH),
  to: text(DATE_INPUT_LENGTH),
  reference: text(REFERENCE_INPUT_LENGTH),
  page: z
    .string()
    .regex(/^[0-9]{1,5}$/)
    .transform(Number)
    .catch(1),
});

export type RawQuery = Readonly<Record<string, string | string[] | undefined>>;

export interface OrdersFilter {
  readonly tab: OrderListTab;
  /** المدى المطبَّق (الافتراضي آخر ثلاثين يومًا حتى اليوم). */
  readonly from: PlainDate;
  readonly to: PlainDate;
  /** هل كتب الموظف المدى بنفسه؟ الافتراضي لا يُكتب في الروابط. */
  readonly customRange: boolean;
  /** تاريخ بغير شكله، أو بداية بعد النهاية: لا يُستعلم، وتُعرض حالة فارغة تشرح. */
  readonly invalidRange: boolean;
  /** ما كُتب في خانة المرجع، ومطبَّعه إن صحّ. */
  readonly reference: { readonly raw: string; readonly normalized: string | null } | null;
  readonly page: number;
}

function parseDay(value: string | undefined): PlainDate | null | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const parsed = parsePlainDate(value);
  // سنة خارج المدى المعقول («0001-01-01») تاريخ صحيح الشكل لا معنى له هنا: مدى غير صحيح
  const inRange = parsed.ok && parsed.value.year >= MIN_YEAR && parsed.value.year <= MAX_YEAR;
  return inRange ? parsed.value : null;
}

function parseReference(value: string | undefined): OrdersFilter["reference"] {
  if (value === undefined || value === "") {
    return null;
  }
  const parsed = parseOrderReference(value);
  return { raw: value, normalized: parsed.ok ? parsed.value : null };
}

/** `today`: اليوم بتقويم النادي. */
export function parseOrdersQuery(query: RawQuery, today: PlainDate): OrdersFilter {
  const parsed = querySchema.parse({
    tab: query.tab,
    from: query.from,
    to: query.to,
    reference: query.reference,
    page: query.page,
  });
  const fromDay = parseDay(parsed.from);
  const toDay = parseDay(parsed.to);
  const from = fromDay ?? addDays(today, 1 - ORDERS_DEFAULT_RANGE_DAYS);
  const to = toDay ?? today;
  return {
    tab: parsed.tab,
    from,
    to,
    customRange: fromDay !== undefined || toDay !== undefined,
    invalidRange: fromDay === null || toDay === null || comparePlainDates(from, to) > 0,
    reference: parseReference(parsed.reference),
    page: Math.min(Math.max(parsed.page, 1), MAX_PAGE),
  };
}

export interface OrdersHrefInput {
  readonly tab?: OrderListTab;
  readonly page?: number;
}

/** رابط القائمة بالتصفية الحالية مع تبويب أو صفحة أخرى. تغيير التبويب يعيد إلى الصفحة الأولى. */
export function ordersHref(filter: OrdersFilter, change: OrdersHrefInput = {}): string {
  const tab = change.tab ?? filter.tab;
  const page = change.tab === undefined ? (change.page ?? filter.page) : 1;
  const query = new URLSearchParams();
  if (tab !== "all") {
    query.set("tab", tab);
  }
  if (filter.customRange && !filter.invalidRange) {
    query.set("from", formatPlainDate(filter.from));
    query.set("to", formatPlainDate(filter.to));
  }
  if (page > 1) {
    query.set("page", String(page));
  }
  const search = query.toString();
  return search === "" ? ADMIN_ROUTES.orders : `${ADMIN_ROUTES.orders}?${search}`;
}
