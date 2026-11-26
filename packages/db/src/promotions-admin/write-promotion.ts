/**
 * إنشاء عرض وتعديله (ADMIN_A2_SALES §5). التعديل يقفل الصف `FOR UPDATE`: القفل نفسه الذي يأخذه
 * `lockPromotions` وT4، فتعديل الحد يتسلسل مع الطلبات. الرمز فريد لكل نادٍ على كل الحالات ولا يتغير.
 */
import {
  DomainError,
  checkPromotionEdit,
  err,
  ok,
  promotionEditPolicy,
  type PromotionDraft,
  type PromotionRule,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type AuditValue, type StaffAuditActor } from "../commerce/audit";
import { toPromotionRule } from "../commerce/load-promotions";
import { inTransaction, type Tx } from "../commerce/transaction";
import type { Prisma } from "../generated/prisma/client";
import { promotionLockToken } from "./read-promotions";
import { isPromotionCreateCollision } from "./sql-errors";

export const PROMOTION_AUDIT_ACTIONS = [
  "promotion_created",
  "promotion_updated",
  "promotion_activated",
  "promotion_paused",
  "promotion_ended",
] as const;
export type PromotionAuditAction = (typeof PROMOTION_AUDIT_ACTIONS)[number];

/** أعمدة الخصم والنطاق والنافذة والحدّين من مسودة المجال. */
function draftColumns(draft: PromotionDraft) {
  const { discount } = draft;
  return {
    nameAr: draft.name.ar,
    nameEn: draft.name.en,
    discountKind: discount.kind,
    percentBps: discount.kind === "percentage" ? discount.rate : null,
    amountMinor: discount.kind === "fixed_amount" ? discount.amount.amountMinor : null,
    currency: discount.kind === "fixed_amount" ? discount.amount.currency : null,
    audience: draft.audience,
    scope: draft.scope.kind,
    stackable: draft.stackable,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    maxRedemptions: draft.maxRedemptions,
    maxRedemptionsPerCustomer: draft.maxRedemptionsPerCustomer,
  } satisfies Partial<Prisma.PromotionUncheckedCreateInput>;
}

export function promotionAuditData(draft: PromotionDraft): Record<string, AuditValue> {
  const columns = draftColumns(draft);
  return {
    code: draft.code,
    discountKind: columns.discountKind,
    percentBps: columns.percentBps,
    amountMinor: columns.amountMinor,
    scope: columns.scope,
    maxRedemptions: columns.maxRedemptions,
    maxPerCustomer: columns.maxRedemptionsPerCustomer,
  };
}

function productIdsOf(draft: PromotionDraft): readonly string[] {
  return draft.scope.kind === "listed_products" ? draft.scope.productIds : [];
}

/** منتجات النطاق كلها من النادي نفسه وغير مؤرشفة؛ وإلا فالطلب مصنوع لا من النموذج. */
async function productsAreSelectable(tx: Tx, clubId: string, ids: readonly string[]) {
  const found = await tx.product.count({
    where: { id: { in: [...ids] }, clubId, kind: { not: "assessed_service" } },
  });
  return found === ids.length;
}

export interface CreatePromotionInput {
  /** يولَّد عند رسم النموذج: الإرسال الثاني بالمعرّف نفسه إعادة لا عرض ثانٍ. */
  readonly promotionId: string;
  readonly clubId: string;
  readonly draft: PromotionDraft;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface CreatedPromotion {
  readonly promotionId: string;
  readonly replayed: boolean;
}

async function createInTransaction(
  tx: Tx,
  input: CreatePromotionInput,
): Promise<Result<CreatedPromotion, DomainError>> {
  const { draft, clubId, promotionId } = input;
  const productIds = productIdsOf(draft);
  if (!(await productsAreSelectable(tx, clubId, productIds))) {
    return err(new DomainError("validation", "promotion.products_invalid", { field: "scope" }));
  }
  await tx.promotion.create({
    data: {
      id: promotionId,
      clubId,
      code: draft.code,
      status: "draft",
      ...draftColumns(draft),
      createdAt: input.now,
      updatedAt: input.now,
      products: { create: productIds.map((productId) => ({ productId })) },
    },
  });
  await writeAudit(tx, {
    clubId,
    entityType: "promotion",
    entityId: promotionId,
    action: "promotion_created",
    fromState: null,
    toState: "draft",
    actor: input.actor,
    data: promotionAuditData(draft),
    at: input.now,
  });
  return ok({ promotionId, replayed: false });
}

async function isReplay(db: Db, input: CreatePromotionInput): Promise<boolean> {
  const existing = await db.promotion.findUnique({
    where: { id: input.promotionId },
    select: { clubId: true, code: true },
  });
  return existing?.clubId === input.clubId && existing.code === input.draft.code;
}

/** ينشئ عرضًا `draft`. رمز مستعمل في النادي، ولو لعرض مؤرشف ⇒ `promotion.code_taken`. */
export async function createPromotion(
  db: Db,
  input: CreatePromotionInput,
): Promise<Result<CreatedPromotion, DomainError>> {
  try {
    return await inTransaction(db, (tx) => createInTransaction(tx, input));
  } catch (error) {
    if (!isPromotionCreateCollision(error)) {
      throw error;
    }
    if (await isReplay(db, input)) {
      return ok({ promotionId: input.promotionId, replayed: true });
    }
    return err(
      new DomainError("conflict", "promotion.code_taken", { field: "code", cause: error }),
    );
  }
}

export interface LockedPromotion {
  readonly rule: PromotionRule;
  readonly updatedAt: Date;
  /** أي صف خصم لهذا العرض، بأي حالة طلب. */
  readonly hasRedemptions: boolean;
  readonly activeRedemptions: number;
}

/** يقفل العرض داخل نادي الموظف ويقرأ قاعدته واستخدامه تحت القفل، بعد فحص رمز القفل المتفائل. */
export async function lockPromotionForEdit(
  tx: Tx,
  input: { promotionId: string; clubId: string; lockToken: string },
): Promise<Result<LockedPromotion, DomainError>> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM promotions
    WHERE id = ${input.promotionId}::uuid AND club_id = ${input.clubId}::uuid FOR UPDATE`;
  if (locked.length === 0) {
    return err(new DomainError("not_found", "promotion.not_found"));
  }
  const row = await tx.promotion.findUniqueOrThrow({
    where: { id: input.promotionId },
    include: { products: { select: { productId: true }, orderBy: { productId: "asc" } } },
  });
  if (promotionLockToken(row.updatedAt) !== input.lockToken) {
    return err(new DomainError("conflict", "promotion.stale_edit"));
  }
  const usage = await tx.$queryRaw<{ total: number; active: number }[]>`
    SELECT count(*)::int AS total,
      (count(*) FILTER (WHERE o.status NOT IN ('expired', 'cancelled')))::int AS active
    FROM order_discounts od JOIN orders o ON o.id = od.order_id
    WHERE od.promotion_id = ${input.promotionId}::uuid`;
  return ok({
    rule: toPromotionRule(row),
    updatedAt: row.updatedAt,
    hasRedemptions: (usage[0]?.total ?? 0) > 0,
    activeRedemptions: usage[0]?.active ?? 0,
  });
}

/** وقت آخر تعديل لا يساوي السابق أبدًا: كتابتان في المللي ثانية نفسها برمزين مختلفين. */
export function nextUpdatedAt(previous: Date, now: Date): Date {
  return new Date(Math.max(now.getTime(), previous.getTime() + 1));
}

export interface UpdatePromotionInput {
  readonly promotionId: string;
  readonly clubId: string;
  readonly lockToken: string;
  readonly draft: PromotionDraft;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface UpdatedPromotion {
  /** الحد الكلي الجديد عند الاستخدام النشط أو دونه: العرض صار مستنفدًا. */
  readonly exhausted: boolean;
}

async function updateInTransaction(
  tx: Tx,
  input: UpdatePromotionInput,
): Promise<Result<UpdatedPromotion, DomainError>> {
  const locked = await lockPromotionForEdit(tx, input);
  if (!locked.ok) {
    return locked;
  }
  const { rule, hasRedemptions, activeRedemptions, updatedAt } = locked.value;
  const { draft } = input;
  const policy = promotionEditPolicy({ status: rule.status, hasRedemptions });
  const allowed = checkPromotionEdit(rule, draft, policy);
  if (!allowed.ok) {
    return allowed;
  }
  const productIds = productIdsOf(draft);
  if (!(await productsAreSelectable(tx, input.clubId, productIds))) {
    return err(new DomainError("validation", "promotion.products_invalid", { field: "scope" }));
  }
  await tx.promotion.update({
    where: { id: rule.id },
    data: { ...draftColumns(draft), updatedAt: nextUpdatedAt(updatedAt, input.now) },
  });
  await tx.promotionProduct.deleteMany({ where: { promotionId: rule.id } });
  await tx.promotionProduct.createMany({
    data: productIds.map((productId) => ({ promotionId: rule.id, productId })),
  });
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: "promotion",
    entityId: rule.id,
    action: "promotion_updated",
    fromState: null,
    toState: null,
    actor: input.actor,
    data: { ...promotionAuditData(draft), termsFrozen: !policy.terms },
    at: input.now,
  });
  const limit = draft.maxRedemptions;
  return ok({ exhausted: limit !== null && activeRedemptions >= limit });
}

/** يعدّل العرض بحسب `promotionEditPolicy`. رمز قفل قديم ⇒ `promotion.stale_edit`. */
export function updatePromotion(
  db: Db,
  input: UpdatePromotionInput,
): Promise<Result<UpdatedPromotion, DomainError>> {
  return inTransaction(db, (tx) => updateInTransaction(tx, input));
}
