/**
 * إنشاء الطلب في معاملة واحدة بالترتيب الحرفي لقسم «createOrder» في التصميم.
 * الطبقة تجمع الحقائق تحت الأقفال وتستدعي `buildOrderDraft` وتكتب ناتجها؛ لا قرار عمل هنا.
 */
import { createHash } from "node:crypto";
import {
  DomainError,
  blockerError,
  buildOrderDraft,
  canonicalOrderRequest,
  checkoutBlockers,
  err,
  ok,
  replayDecision,
  type Buyer,
  type CommercePolicy,
  type CouponCode,
  type OrderFacts,
  type RequestLocale,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import { EXPIRE_BATCH_SIZE, expireAllDueOrders } from "./expire-orders";
import {
  cartVersionIds,
  loadBenefits,
  loadCartLines,
  withBenefits,
  type CatalogCart,
} from "./load-catalog";
import { countPendingOrders, loadStanding } from "./load-customer";
import {
  candidateIdList,
  loadCandidateIds,
  loadPromotionCandidates,
  toPromotionFacts,
} from "./load-promotions";
import {
  ensureCustomerLocked,
  lockIdempotencyKey,
  lockPromotions,
  lockVersionsForShare,
} from "./locks";
import { loadCommercePolicy } from "./policy";
import { IDEMPOTENCY_RETRY, mapCommerceDbError } from "./sql-errors";
import { abort, inTransaction, type Tx } from "./transaction";
import { insertOrderDraft } from "./write-order";

export interface CreateOrderInput {
  readonly planSlug: string;
  readonly addonSlugs: readonly string[];
  readonly couponCode: CouponCode | null;
  readonly buyer: Buyer;
  readonly locale: RequestLocale;
  /** UUID يولّده النموذج عند العرض؛ الضغطتان بالمفتاح نفسه طلب واحد. */
  readonly idempotencyKey: string;
  /** 32 بايت عشوائي base64url يولّده المستدعي. */
  readonly publicToken: string;
  /** الإجمالي الذي رآه العميل؛ أي فرق ⇒ `cart.price_changed` بلا كتابة. */
  readonly quotedTotalMinor: number;
  readonly maxPendingOrders: number;
  readonly now: Date;
}

export interface CreatedOrder {
  readonly orderId: string;
  readonly reference: string;
  readonly publicToken: string;
  readonly replayed: boolean;
}

interface StoredOrder {
  readonly id: string;
  readonly reference: string;
  readonly publicToken: string;
  readonly requestFingerprint: string;
}

/** بصمة الطلب: sha256 للصيغة المعيارية، 64 محرفًا ست عشريًا. */
export function orderFingerprint(input: CreateOrderInput): string {
  const canonical = canonicalOrderRequest({
    planSlug: input.planSlug,
    addonSlugs: input.addonSlugs,
    couponCode: input.couponCode,
    buyer: input.buyer,
    locale: input.locale,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function findByKey(client: Tx, idempotencyKey: string): Promise<StoredOrder | null> {
  return client.order.findUnique({
    where: { idempotencyKey },
    select: { id: true, reference: true, publicToken: true, requestFingerprint: true },
  });
}

/** المفتاح نفسه ببصمة مطابقة ⇒ الطلب نفسه، وببصمة مختلفة ⇒ تعارض بلا كتابة. */
function replayOrConflict(
  stored: StoredOrder,
  fingerprint: string,
): Result<CreatedOrder, DomainError> {
  if (replayDecision(stored.requestFingerprint, fingerprint) === "conflict") {
    return err(new DomainError("conflict", "order.idempotency_key_reused"));
  }
  return ok({
    orderId: stored.id,
    reference: stored.reference,
    publicToken: stored.publicToken,
    replayed: true,
  });
}

interface FactsContext {
  readonly input: CreateOrderInput;
  readonly cart: CatalogCart;
  readonly policy: CommercePolicy;
  readonly customerId: string;
}

/** الخطوات 5-8: النسخ ثم العروض تحت أقفالها، وإنهاء المستحق، ثم الاستخدام والمكانة والمعلّق. */
async function gatherFacts(tx: Tx, context: FactsContext): Promise<OrderFacts> {
  const { input, cart, policy, customerId } = context;
  const versionIds = cartVersionIds(cart);
  await lockVersionsForShare(tx, versionIds);
  const lines = withBenefits(cart, await loadBenefits(tx, versionIds));
  const productIds = [cart.primary, ...cart.addons].map((line) => line.productId);
  const ids = await loadCandidateIds(tx, cart.clubId, productIds, input.couponCode, input.now);
  const promotionIds = candidateIdList(ids);
  await lockPromotions(tx, promotionIds);
  const scope = { now: input.now, limit: EXPIRE_BATCH_SIZE, customerId, promotionIds };
  await expireAllDueOrders(tx, scope);
  const candidates = await loadPromotionCandidates(tx, promotionIds, customerId);
  return {
    ...lines,
    attachableAddonProductIds: cart.attachableAddonProductIds,
    policy,
    ...toPromotionFacts(ids, input.couponCode, candidates),
    customer: {
      standing: await loadStanding(tx, customerId),
      pendingOrders: await countPendingOrders(tx, customerId, input.now),
    },
    maxPendingOrders: input.maxPendingOrders,
    buyer: input.buyer,
    locale: input.locale,
    now: input.now,
  };
}

/** الخطوات 3-4: الكتالوج وسياسة النادي، ثم صف العميل مقفلًا. */
async function loadCartAndCustomer(tx: Tx, input: CreateOrderInput): Promise<FactsContext> {
  const cart = await loadCartLines(tx, input);
  if (!cart.ok) {
    abort(cart.error);
  }
  const policy = await loadCommercePolicy(tx, cart.value.clubId);
  const blockers = checkoutBlockers(policy, cart.value.primary.kind);
  if (blockers.length > 0) {
    abort(blockerError(blockers));
  }
  const customerId = await ensureCustomerLocked(tx, cart.value.clubId, input.buyer.mobile);
  return { input, cart: cart.value, policy, customerId };
}

async function createInTransaction(
  tx: Tx,
  input: CreateOrderInput,
  fingerprint: string,
): Promise<Result<CreatedOrder, DomainError>> {
  await lockIdempotencyKey(tx, input.idempotencyKey);
  const stored = await findByKey(tx, input.idempotencyKey);
  if (stored !== null) {
    return replayOrConflict(stored, fingerprint);
  }
  const context = await loadCartAndCustomer(tx, input);
  const draft = buildOrderDraft(await gatherFacts(tx, context));
  if (!draft.ok) {
    abort(draft.error);
  }
  const totalMinor = draft.value.total.amountMinor;
  if (totalMinor !== input.quotedTotalMinor) {
    abort(new DomainError("conflict", "cart.price_changed", { cause: { totalMinor } }));
  }
  const written = await insertOrderDraft(tx, draft.value, {
    clubId: context.cart.clubId,
    customerId: context.customerId,
    idempotencyKey: input.idempotencyKey,
    fingerprint,
    publicToken: input.publicToken,
  });
  return ok({ ...written, publicToken: input.publicToken, replayed: false });
}

/** القفل الاستشاري يمنع السباق على المفتاح؛ إن تخطّاه شيء فالقيد الفريد يرفض، فيُعاد مسار القراءة. */
async function rereadAfterKeyRace(
  db: Db,
  input: CreateOrderInput,
  fingerprint: string,
  cause: unknown,
): Promise<Result<CreatedOrder, DomainError>> {
  const stored = await findByKey(db, input.idempotencyKey);
  if (stored === null) {
    throw new DomainError("invariant", "order.idempotency_key_missing", { cause });
  }
  return replayOrConflict(stored, fingerprint);
}

/**
 * ينشئ طلبًا معلّقًا من سلة وكوبون ومشترٍ. خطأ العمل يتراجع عن كل شيء (ومنه صف العميل الجديد).
 * النتيجة `replayed` تعني أن المفتاح نفسه أنشأ الطلب من قبل بالبيانات نفسها.
 */
export async function createOrder(
  db: Db,
  input: CreateOrderInput,
): Promise<Result<CreatedOrder, DomainError>> {
  const fingerprint = orderFingerprint(input);
  try {
    return await inTransaction(db, (tx) => createInTransaction(tx, input, fingerprint));
  } catch (error) {
    const mapped = mapCommerceDbError(error);
    if (mapped?.reason === IDEMPOTENCY_RETRY) {
      return rereadAfterKeyRace(db, input, fingerprint, error);
    }
    if (mapped !== undefined) {
      return err(mapped);
    }
    throw error;
  }
}
