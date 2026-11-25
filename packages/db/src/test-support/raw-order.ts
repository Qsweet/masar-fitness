/**
 * إدراج خام لطلب وسطوره وخصوماته بـSQL مباشر، لاختبار قيود القاعدة دون طبقة الطلبات.
 * الأرقام الصحيحة تُحسب هنا مستقلةً عن كود المجال.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { Db } from "../client";
import type {
  DiscountSource,
  MembershipStartRule,
  MembershipStatus,
  Prisma,
} from "../generated/prisma/client";
import {
  TEST_NOW,
  TEST_PAYMENT_WINDOW_MINUTES,
  TEST_PHONE,
  TEST_VAT_RATE_BPS,
  type TestProduct,
} from "./commerce-constants";

const MINUTE_MS = 60_000;
const BASIS_POINTS = 10_000n;
/** النصف يُرفع: floor((2·a·n + d) / (2·d)) */
const HALF_UP_SCALE = 2n;
const TOKEN_BYTES = 32;

export async function ensureCustomer(db: Db, clubId: string, phone: string): Promise<string> {
  await db.$executeRaw`
    INSERT INTO customers (id, club_id, phone_e164) VALUES (${randomUUID()}::uuid, ${clubId}::uuid, ${phone})
    ON CONFLICT (club_id, phone_e164) DO NOTHING`;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id::text FROM customers WHERE club_id = ${clubId}::uuid AND phone_e164 = ${phone}`;
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error("ensureCustomer: لم يُنشأ العميل");
  }
  return id;
}

/** ضريبة مستخرجة من مبلغ شامل بالنصف يُرفع، بحساب صحيح مستقل عن كود المجال. */
export function includedVat(totalMinor: number, rateBps: number): number {
  const rate = BigInt(rateBps);
  const denominator = BASIS_POINTS + rate;
  const scaled = HALF_UP_SCALE * BigInt(totalMinor) * rate + denominator;
  return Number(scaled / (HALF_UP_SCALE * denominator));
}

export function expiryAfter(createdAt: Date, minutes = TEST_PAYMENT_WINDOW_MINUTES): Date {
  return new Date(createdAt.getTime() + minutes * MINUTE_MS);
}

export function randomPublicToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function randomFingerprint(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export interface RawLine {
  product: TestProduct;
  discountMinor?: number;
  /** يغيّر الضريبة المحسوبة لاختبار الرفض */
  vatMinor?: number;
  /** قاعدة البدء المختومة؛ الافتراضي on_payment لسطر الاشتراك و null لغيره */
  startRule?: MembershipStartRule | null;
}

export interface RawDiscount {
  promotionId: string;
  amountMinor: number;
  source?: DiscountSource;
  code?: string | null;
  sequence?: number;
}

export interface RawTotals {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  vatMinor: number;
}

export interface RawOrderInput {
  clubId: string;
  lines: RawLine[];
  phone?: string;
  discounts?: RawDiscount[];
  /** يغيّر مجاميع الرأس المحسوبة لاختبار الرفض */
  head?: Partial<RawTotals>;
  createdAt?: Date;
  expiresAt?: Date;
}

export interface RawOrder {
  orderId: string;
  customerId: string;
  itemIds: string[];
  totals: RawTotals;
}

type Tx = Prisma.TransactionClient;

function lineAmounts(line: RawLine): { discount: number; total: number; vat: number } {
  const discount = line.discountMinor ?? 0;
  const total = line.product.priceMinor - discount;
  return { discount, total, vat: line.vatMinor ?? includedVat(total, TEST_VAT_RATE_BPS) };
}

function computeTotals(input: RawOrderInput): RawTotals {
  const sum = (pick: (line: RawLine) => number): number =>
    input.lines.reduce((acc, line) => acc + pick(line), 0);
  return {
    subtotalMinor: sum((line) => line.product.priceMinor),
    discountMinor: sum((line) => lineAmounts(line).discount),
    totalMinor: sum((line) => lineAmounts(line).total),
    vatMinor: sum((line) => lineAmounts(line).vat),
    ...input.head,
  };
}

async function insertHead(tx: Tx, input: RawOrderInput, ids: RawOrder): Promise<void> {
  const createdAt = input.createdAt ?? TEST_NOW;
  const expiresAt = input.expiresAt ?? expiryAfter(createdAt);
  const { subtotalMinor, discountMinor, totalMinor, vatMinor } = ids.totals;
  await tx.$executeRaw`
    INSERT INTO orders (id, club_id, public_token, idempotency_key, request_fingerprint, customer_id,
      customer_name, customer_phone_e164, locale, currency, vat_rate_bps, subtotal_minor, discount_minor,
      total_minor, vat_minor, created_at, expires_at)
    VALUES (${ids.orderId}::uuid, ${input.clubId}::uuid, ${randomPublicToken()}, ${randomUUID()}::uuid,
      ${randomFingerprint()}, ${ids.customerId}::uuid, 'عميل اختبار', ${input.phone ?? TEST_PHONE}, 'ar',
      'SAR', ${TEST_VAT_RATE_BPS}, ${subtotalMinor}, ${discountMinor}, ${totalMinor}, ${vatMinor},
      ${createdAt}, ${expiresAt})`;
}

async function insertLine(
  tx: Tx,
  orderId: string,
  line: RawLine,
  position: number,
): Promise<string> {
  const id = randomUUID();
  const { product } = line;
  const defaultRule: MembershipStartRule | null =
    product.kind === "membership" ? "on_payment" : null;
  const startRule = line.startRule === undefined ? defaultRule : line.startRule;
  const { discount, total, vat } = lineAmounts(line);
  await tx.$executeRaw`
    INSERT INTO order_items (id, order_id, position, kind, product_id, product_version_id, product_slug,
      name_ar, name_en, summary_ar, summary_en, benefits, duration_months, bonus_months,
      membership_start_rule, currency, vat_rate_bps, list_price_minor, discount_minor, total_minor, vat_minor)
    VALUES (${id}::uuid, ${orderId}::uuid, ${position}, ${product.kind}::product_kind,
      ${product.productId}::uuid, ${product.versionId}::uuid, 'test-product', 'منتج', 'Product', 'وصف',
      'Summary', '[{"ar":"ميزة","en":"Benefit"}]'::jsonb, ${product.durationMonths}::integer,
      ${product.bonusMonths}, ${startRule}::membership_start_rule, 'SAR', ${TEST_VAT_RATE_BPS},
      ${product.priceMinor}, ${discount}, ${total}, ${vat})`;
  return id;
}

async function insertDiscount(
  tx: Tx,
  ids: RawOrder,
  discount: RawDiscount,
  index: number,
): Promise<void> {
  const source = discount.source ?? "automatic";
  const code =
    discount.code === undefined ? (source === "coupon" ? "TESTCODE" : null) : discount.code;
  await tx.$executeRaw`
    INSERT INTO order_discounts (id, order_id, customer_id, promotion_id, source, code, name_ar, name_en,
      discount_kind, fixed_amount_minor, sequence, amount_minor, created_at)
    VALUES (${randomUUID()}::uuid, ${ids.orderId}::uuid, ${ids.customerId}::uuid,
      ${discount.promotionId}::uuid, ${source}::discount_source, ${code}, 'خصم', 'Discount',
      'fixed_amount', ${discount.amountMinor}, ${discount.sequence ?? index + 1}, ${discount.amountMinor},
      ${TEST_NOW})`;
}

/**
 * يدرج طلبًا معلّقًا وسطوره وخصوماته في معاملة واحدة، بمجاميع صحيحة محسوبة هنا ما لم تُغيَّر.
 * فحص المجاميع المؤجَّل (T3) يعمل عند COMMIT، فالخطأ يظهر من هذه الدالة نفسها.
 */
export async function insertRawOrder(db: Db, input: RawOrderInput): Promise<RawOrder> {
  const customerId = await ensureCustomer(db, input.clubId, input.phone ?? TEST_PHONE);
  const ids: RawOrder = {
    orderId: randomUUID(),
    customerId,
    itemIds: [],
    totals: computeTotals(input),
  };
  await db.$transaction(async (tx) => {
    await insertHead(tx, input, ids);
    for (const [position, line] of input.lines.entries()) {
      ids.itemIds.push(await insertLine(tx, ids.orderId, line, position));
    }
    for (const [index, discount] of (input.discounts ?? []).entries()) {
      await insertDiscount(tx, ids, discount, index);
    }
  });
  return ids;
}

export interface RawPayment {
  paidAt: Date;
  provider?: string;
  paymentId?: string;
}

/** يسوّي طلبًا معلّقًا بمبلغه وعملته تمامًا، كما ستفعل طبقة الدفع. */
export async function markRawPaid(db: Db, orderId: string, payment: RawPayment): Promise<void> {
  await db.$executeRaw`
    UPDATE orders SET status = 'paid', paid_at = ${payment.paidAt},
      paid_provider = ${payment.provider ?? "test_pay"},
      paid_provider_payment_id = ${payment.paymentId ?? randomUUID()},
      paid_amount_minor = total_minor, paid_currency = currency
    WHERE id = ${orderId}::uuid`;
}

export interface RawMembershipInput {
  clubId: string;
  order: RawOrder;
  orderPaidAt: Date;
  paidMonths: number;
  bonusMonths: number;
  itemIndex?: number;
  status?: MembershipStatus;
  /** YYYY-MM-DD أو null لاشتراك مجدول بلا تواريخ */
  startsOn?: string | null;
  endsOn?: string | null;
}

export async function insertRawMembership(db: Db, input: RawMembershipInput): Promise<string> {
  const id = randomUUID();
  const itemId = input.order.itemIds[input.itemIndex ?? 0];
  await db.$executeRaw`
    INSERT INTO memberships (id, club_id, customer_id, order_id, order_item_id, order_paid_at,
      paid_months, bonus_months, start_rule, status, starts_on, ends_on, updated_at)
    VALUES (${id}::uuid, ${input.clubId}::uuid, ${input.order.customerId}::uuid,
      ${input.order.orderId}::uuid, ${itemId}::uuid, ${input.orderPaidAt}, ${input.paidMonths},
      ${input.bonusMonths}, 'on_payment', ${input.status ?? "scheduled"}::membership_status,
      ${input.startsOn ?? null}::date, ${input.endsOn ?? null}::date, ${input.orderPaidAt})`;
  return id;
}

/** يكتب الطلب منتهيًا عند لحظة مهلته تمامًا، كما سيفعل expireDueOrders. */
export async function expireRawOrder(db: Db, orderId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE orders SET status = 'expired', expired_at = expires_at WHERE id = ${orderId}::uuid`;
}
