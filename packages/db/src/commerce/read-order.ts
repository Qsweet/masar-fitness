/**
 * صفحة مراجعة الطلب: من اللقطة المختومة فقط، بلا join على الكتالوج، فتعديل المنتج أو أرشفته
 * بعد الإنشاء لا يغيّر ما يراه العميل. الحالة المعروضة فعلية، والجوال مقنَّع.
 */
import {
  DomainError,
  effectiveOrderStatus,
  maskSaudiMobile,
  money,
  type LocalizedText,
  type MembershipStartRule,
  type Money,
  type OrderStatus,
  type RequestLocale,
} from "@masar/domain";
import type { Db } from "../client";
import type { DiscountSource, Prisma, ProductKind } from "../generated/prisma/client";

export interface OrderItemView {
  readonly position: number;
  readonly kind: ProductKind;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  readonly benefits: readonly LocalizedText[];
  readonly paidMonths: number | null;
  readonly bonusMonths: number;
  readonly membershipStartRule: MembershipStartRule | null;
  readonly listPrice: Money;
  readonly discount: Money;
  readonly total: Money;
  readonly vat: Money;
}

export interface OrderDiscountView {
  readonly source: DiscountSource;
  readonly code: string | null;
  readonly name: LocalizedText;
  readonly sequence: number;
  readonly amount: Money;
}

export interface OrderView {
  readonly id: string;
  readonly reference: string;
  readonly customerName: string;
  /** مقنَّع: آخر رقمين في الصفحة العامة، وآخر أربعة في اللوحة. الجوال الكامل لا يخرج من هنا. */
  readonly maskedPhone: string;
  readonly locale: RequestLocale;
  readonly status: OrderStatus;
  readonly effectiveStatus: OrderStatus;
  readonly vatRateBps: number;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly total: Money;
  readonly vat: Money;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  /** منطقة النادي لعرض المهلة بتوقيته. */
  readonly timeZone: string;
  readonly items: readonly OrderItemView[];
  readonly discounts: readonly OrderDiscountView[];
}

/** الصفحة العامة تُظهر آخر رقمين فقط. */
const PUBLIC_VISIBLE_PHONE_DIGITS = 2;

function isLocalizedText(value: unknown): value is LocalizedText {
  return (
    typeof value === "object" &&
    value !== null &&
    "ar" in value &&
    "en" in value &&
    typeof value.ar === "string" &&
    typeof value.en === "string"
  );
}

/** المزايا JSONB كما خُتمت؛ CHECK يضمن أنها مصفوفة، والشكل يُتحقق منه هنا. */
function toBenefits(value: unknown): LocalizedText[] {
  if (!Array.isArray(value) || !value.every(isLocalizedText)) {
    throw new DomainError("invariant", "order_item.benefits_malformed");
  }
  return value.map((benefit) => ({ ar: benefit.ar, en: benefit.en }));
}

/** CHECK القاعدة يحصر اللغة في ar و en. */
function toLocale(value: string): RequestLocale {
  if (value !== "ar" && value !== "en") {
    throw new DomainError("invariant", "order.locale_unsupported");
  }
  return value;
}

/** ما يُقرأ مع الطلب ليُعرض من لقطته: سطوره وخصوماته ومنطقة ناديه. */
export const ORDER_VIEW_INCLUDE = {
  items: { orderBy: { position: "asc" } },
  discounts: { orderBy: { sequence: "asc" } },
  club: { select: { timezone: true } },
} as const satisfies Prisma.OrderInclude;

export type OrderViewRow = Prisma.OrderGetPayload<{ include: typeof ORDER_VIEW_INCLUDE }>;
type OrderRow = OrderViewRow;

function toItem(item: OrderRow["items"][number]): OrderItemView {
  return {
    position: item.position,
    kind: item.kind,
    slug: item.productSlug,
    name: { ar: item.nameAr, en: item.nameEn },
    summary: { ar: item.summaryAr, en: item.summaryEn },
    benefits: toBenefits(item.benefits),
    paidMonths: item.durationMonths,
    bonusMonths: item.bonusMonths,
    membershipStartRule: item.membershipStartRule,
    listPrice: money(item.listPriceMinor, item.currency),
    discount: money(item.discountMinor, item.currency),
    total: money(item.totalMinor, item.currency),
    vat: money(item.vatMinor, item.currency),
  };
}

function toDiscount(row: OrderRow["discounts"][number], currency: string): OrderDiscountView {
  return {
    source: row.source,
    code: row.code,
    name: { ar: row.nameAr, en: row.nameEn },
    sequence: row.sequence,
    amount: money(row.amountMinor, currency),
  };
}

/**
 * الطلب كما يُعرض، من لقطته وحدها. المشترك بين صفحة العميل العامة وتفصيل الطلب في اللوحة؛ الفرق
 * الوحيد عدد أرقام الجوال الظاهرة.
 */
export function toOrderView(row: OrderViewRow, now: Date, visiblePhoneDigits: number): OrderView {
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    maskedPhone: maskSaudiMobile(row.customerPhoneE164, visiblePhoneDigits),
    locale: toLocale(row.locale),
    status: row.status,
    effectiveStatus: effectiveOrderStatus(row.status, row.expiresAt, now),
    vatRateBps: row.vatRateBps,
    subtotal: money(row.subtotalMinor, row.currency),
    discount: money(row.discountMinor, row.currency),
    total: money(row.totalMinor, row.currency),
    vat: money(row.vatMinor, row.currency),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    timeZone: row.club.timezone,
    items: row.items.map(toItem),
    discounts: row.discounts.map((discount) => toDiscount(discount, row.currency)),
  };
}

/** الطلب برمزه العام، أو undefined إن لم يوجد. */
export async function findOrderByPublicToken(
  db: Db,
  publicToken: string,
  now: Date,
): Promise<OrderView | undefined> {
  const row = await db.order.findUnique({ where: { publicToken }, include: ORDER_VIEW_INCLUDE });
  return row === null ? undefined : toOrderView(row, now, PUBLIC_VISIBLE_PHONE_DIGITS);
}
