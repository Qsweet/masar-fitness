/**
 * طلب تقييم لخدمة بتقييم (ليد لا طلب شراء)، في معاملة واحدة: قفل المفتاح ← الطلب القائم بالمفتاح
 * والبصمة ← المنتج و`validateAssessmentRequest` ← العميل ← الإدراج والتدقيق. FK7 يرفض أي منتج آخر.
 */
import { createHash } from "node:crypto";
import {
  DomainError,
  canonicalAssessmentRequest,
  err,
  ok,
  replayDecision,
  validateAssessmentRequest,
  type Buyer,
  type RequestLocale,
  type Result,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit } from "./audit";
import { ensureCustomerLocked, lockIdempotencyKey } from "./locks";
import { COMMERCE_CONSTRAINTS, isUniqueViolation } from "./sql-errors";
import { abort, inTransaction, type Tx } from "./transaction";

export interface AssessmentRequestCommand {
  readonly productSlug: string;
  readonly buyer: Buyer;
  readonly locale: RequestLocale;
  readonly idempotencyKey: string;
  readonly now: Date;
}

export interface CreatedAssessmentRequest {
  readonly id: string;
  readonly replayed: boolean;
}

export function assessmentFingerprint(command: AssessmentRequestCommand): string {
  const canonical = canonicalAssessmentRequest({
    productSlug: command.productSlug,
    buyer: command.buyer,
    locale: command.locale,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

async function findExisting(
  client: Tx,
  idempotencyKey: string,
  fingerprint: string,
): Promise<Result<CreatedAssessmentRequest, DomainError> | undefined> {
  const stored = await client.assessmentRequest.findUnique({
    where: { idempotencyKey },
    select: { id: true, requestFingerprint: true },
  });
  if (stored === null) {
    return undefined;
  }
  return replayDecision(stored.requestFingerprint, fingerprint) === "replay"
    ? ok({ id: stored.id, replayed: true })
    : err(new DomainError("conflict", "assessment.idempotency_key_reused"));
}

async function insertRequest(
  tx: Tx,
  command: AssessmentRequestCommand,
  fingerprint: string,
): Promise<Result<CreatedAssessmentRequest, DomainError>> {
  const product = await tx.product.findUnique({
    where: { slug: command.productSlug },
    select: { id: true, clubId: true, kind: true, status: true },
  });
  const valid = validateAssessmentRequest({ product: product ?? undefined });
  if (!valid.ok) {
    abort(valid.error);
  }
  if (product === null) {
    throw new DomainError("invariant", "assessment.product_missing");
  }
  const customerId = await ensureCustomerLocked(tx, product.clubId, command.buyer.mobile);
  const created = await tx.assessmentRequest.create({
    data: {
      clubId: product.clubId,
      customerId,
      productId: product.id,
      customerName: command.buyer.name,
      customerPhoneE164: command.buyer.mobile,
      locale: command.locale,
      idempotencyKey: command.idempotencyKey,
      requestFingerprint: fingerprint,
      createdAt: command.now,
    },
    select: { id: true },
  });
  await writeAudit(tx, {
    clubId: product.clubId,
    entityType: "assessment_request",
    entityId: created.id,
    action: "assessment_requested",
    fromState: null,
    toState: null,
    actor: "customer",
    data: { productId: product.id },
    at: command.now,
  });
  return ok({ id: created.id, replayed: false });
}

/** ينشئ طلب تقييم واحدًا لكل مفتاح؛ التكرار بالبيانات نفسها يرجع الطلب نفسه (`replayed`). */
export async function createAssessmentRequest(
  db: Db,
  command: AssessmentRequestCommand,
): Promise<Result<CreatedAssessmentRequest, DomainError>> {
  const fingerprint = assessmentFingerprint(command);
  try {
    return await inTransaction(db, async (tx) => {
      await lockIdempotencyKey(tx, command.idempotencyKey);
      const existing = await findExisting(tx, command.idempotencyKey, fingerprint);
      return existing ?? (await insertRequest(tx, command, fingerprint));
    });
  } catch (error) {
    if (!isUniqueViolation(error, COMMERCE_CONSTRAINTS.assessmentIdempotencyKey)) {
      throw error;
    }
    const existing = await findExisting(db, command.idempotencyKey, fingerprint);
    if (existing === undefined) {
      throw new DomainError("invariant", "assessment.idempotency_key_missing", { cause: error });
    }
    return existing;
  }
}
