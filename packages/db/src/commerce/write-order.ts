/** كتابة مسودة الطلب حرفيًا: الرأس، ثم السطور، ثم الخصومات، ثم التدقيق. لا حساب هنا. */
import type { AppliedDiscount, OrderDraft, OrderItemDraft } from "@masar/domain";
import type { Prisma } from "../generated/prisma/client";
import { writeAudit } from "./audit";
import type { Tx } from "./transaction";

export interface OrderIds {
  readonly clubId: string;
  readonly customerId: string;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly publicToken: string;
}

export interface WrittenOrder {
  readonly orderId: string;
  readonly reference: string;
}

function itemRow(
  orderId: string,
  vatRate: number,
  item: OrderItemDraft,
): Prisma.OrderItemCreateManyInput {
  return {
    orderId,
    position: item.position,
    kind: item.kind,
    productId: item.productId,
    productVersionId: item.versionId,
    productSlug: item.slug,
    nameAr: item.name.ar,
    nameEn: item.name.en,
    summaryAr: item.summary.ar,
    summaryEn: item.summary.en,
    benefits: item.benefits.map((benefit) => ({ ar: benefit.ar, en: benefit.en })),
    durationMonths: item.paidMonths,
    bonusMonths: item.bonusMonths,
    membershipStartRule: item.membershipStartRule,
    currency: item.listPrice.currency,
    vatRateBps: vatRate,
    listPriceMinor: item.listPrice.amountMinor,
    discountMinor: item.discount.amountMinor,
    totalMinor: item.total.amountMinor,
    vatMinor: item.vat.amountMinor,
  };
}

function discountRow(
  orderId: string,
  customerId: string,
  createdAt: Date,
  discount: AppliedDiscount,
): Prisma.OrderDiscountCreateManyInput {
  const rule = discount.discountRule;
  return {
    orderId,
    customerId,
    promotionId: discount.promotionId,
    source: discount.source,
    code: discount.code,
    nameAr: discount.name.ar,
    nameEn: discount.name.en,
    discountKind: rule.kind,
    percentBps: rule.kind === "percentage" ? rule.rate : null,
    fixedAmountMinor: rule.kind === "fixed_amount" ? rule.amount.amountMinor : null,
    sequence: discount.sequence,
    amountMinor: discount.amount.amountMinor,
    createdAt,
  };
}

function headRow(draft: OrderDraft, ids: OrderIds): Prisma.OrderUncheckedCreateInput {
  return {
    clubId: ids.clubId,
    publicToken: ids.publicToken,
    idempotencyKey: ids.idempotencyKey,
    requestFingerprint: ids.fingerprint,
    customerId: ids.customerId,
    customerName: draft.buyer.name,
    customerPhoneE164: draft.buyer.mobile,
    locale: draft.locale,
    currency: draft.currency,
    vatRateBps: draft.vatRate,
    subtotalMinor: draft.subtotal.amountMinor,
    discountMinor: draft.discount.amountMinor,
    totalMinor: draft.total.amountMinor,
    vatMinor: draft.vat.amountMinor,
    createdAt: draft.createdAt,
    expiresAt: draft.expiresAt,
  };
}

/** يكتب الطلب كما قررته `buildOrderDraft`. T3 يتحقق من المجاميع عند COMMIT. */
export async function insertOrderDraft(
  tx: Tx,
  draft: OrderDraft,
  ids: OrderIds,
): Promise<WrittenOrder> {
  const order = await tx.order.create({
    data: headRow(draft, ids),
    select: { id: true, reference: true },
  });
  await tx.orderItem.createMany({
    data: draft.items.map((item) => itemRow(order.id, draft.vatRate, item)),
  });
  if (draft.discounts.length > 0) {
    await tx.orderDiscount.createMany({
      data: draft.discounts.map((discount) =>
        discountRow(order.id, ids.customerId, draft.createdAt, discount),
      ),
    });
  }
  await writeAudit(tx, {
    clubId: ids.clubId,
    entityType: "order",
    entityId: order.id,
    action: "order_created",
    fromState: null,
    toState: "pending_payment",
    actor: "customer",
    data: {
      reference: order.reference,
      totalMinor: draft.total.amountMinor,
      currency: draft.currency,
      couponOutcome: draft.couponOutcome.kind,
    },
    at: draft.createdAt,
  });
  return { orderId: order.id, reference: order.reference };
}
