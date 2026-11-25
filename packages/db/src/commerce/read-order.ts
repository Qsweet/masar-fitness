/**
 * صفحة مراجعة الطلب: من اللقطة المختومة فقط، بلا join على الكتالوج، فتعديل المنتج أو أرشفته
 * بعد الإنشاء لا يغيّر ما يراه العميل. الحالة المعروضة فعلية، والجوال مقنَّع.
 */
import {
  DomainError,
  effectiveOrderStatus,
  money,
  type LocalizedText,
  type MembershipStartRule,
  type Money,
  type OrderStatus,
  type RequestLocale,
} from "@masar/domain";
import type { Db } from "../client";
import type { DiscountSource, ProductKind } from "../generated/prisma/client";

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
  /** آخر رقمين فقط ظاهران. */
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

const VISIBLE_PHONE_DIGITS = 2;
/** «+966» تبقى ظاهرة: لا تكشف شيئًا لأن كل الجوالات المقبولة سعودية. */
const COUNTRY_PREFIX_LENGTH = 4;
const MASK = "•";

export function maskPhone(e164: string): string {
  const hidden = e164.length - COUNTRY_PREFIX_LENGTH - VISIBLE_PHONE_DIGITS;
  return (
    e164.slice(0, COUNTRY_PREFIX_LENGTH) + MASK.repeat(hidden) + e164.slice(-VISIBLE_PHONE_DIGITS)
  );
}

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

function findOrder(db: Db, publicToken: string) {
  return db.order.findUnique({
    where: { publicToken },
    include: {
      items: { orderBy: { position: "asc" } },
      discounts: { orderBy: { sequence: "asc" } },
      club: { select: { timezone: true } },
    },
  });
}

type OrderRow = NonNullable<Awaited<ReturnType<typeof findOrder>>>;

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

/** الطلب برمزه العام، أو undefined إن لم يوجد. */
export async function findOrderByPublicToken(
  db: Db,
  publicToken: string,
  now: Date,
): Promise<OrderView | undefined> {
  const row = await findOrder(db, publicToken);
  if (row === null) {
    return undefined;
  }
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    maskedPhone: maskPhone(row.customerPhoneE164),
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
