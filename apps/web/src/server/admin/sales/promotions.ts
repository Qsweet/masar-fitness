import "server-only";
import {
  AUTOMATIC_ZEROES_SALE,
  automaticZeroedNames,
  createPromotion,
  getSalesSettings,
  setPromotionStatus,
  staffActor,
  updatePromotion,
  type PromotionStatusResult,
} from "@masar/db";
import {
  CURRENCIES,
  err,
  isPromotionStatusAction,
  ok,
  validatePromotionDraft,
  type DomainError,
  type PromotionDraft,
  type Result,
} from "@masar/domain";
import { getDb } from "../../db";
import { failureOf, formFailure, type FormFailure, type FormValues } from "../field-form";
import type { StaffContext } from "../session";
import { promotionInput } from "./promotion-form";

/**
 * كتابات العروض باسم الموظف (ADMIN_A2_SALES §5). الخصم والنافذة والحدود تُتحقق في المجال (الرمز بـ
 * `parseCouponCode` نفسها)، والكتابة والقفل والتدقيق في `@masar/db`. كلها مقيَّدة بنادي الموظف.
 */
type Saved<T> = Promise<Result<T, FormFailure>>;

const INVALID = "sales.invalid_request";
const ZEROES_ON_ACTIVATE = "promotion.automatic_zeroes_sale_now";

/** المسودة من قيم النموذج، بعملة النادي ومنطقته الزمنية. */
async function draftOf(context: StaffContext, values: FormValues): Saved<PromotionDraft> {
  const club = await getSalesSettings(getDb(), context.staff.clubId);
  const currency = CURRENCIES.find((supported) => supported === club.currency);
  if (currency === undefined) {
    return err(formFailure(INVALID));
  }
  const draft = validatePromotionDraft(promotionInput(values), {
    currency,
    timeZone: club.timezone,
  });
  return draft.ok ? ok(draft.value) : err(failureOf(draft.error));
}

/**
 * رفض الكتابة ← ما يعرضه النموذج. العرض التلقائي الذي يجعل منتجًا مجانيًا يُسمّى فيه المنتج (بالعربية،
 * لغة اللوحة)، ليعرف الموظف أي باقة يمسّها خصمه.
 */
async function writeFailure(
  context: StaffContext,
  draft: PromotionDraft,
  error: DomainError,
  now: Date,
): Promise<FormFailure> {
  const failure = failureOf(error);
  if (error.reason !== AUTOMATIC_ZEROES_SALE) {
    return failure;
  }
  const names = await automaticZeroedNames(getDb(), context.staff.clubId, draft, now);
  return { ...failure, detail: names.map((name) => name.ar).join("»، «") };
}

/** ينشئ عرضًا مسودة. `promotionId` من النموذج: الإرسال الثاني إعادة لا عرض ثانٍ. */
export async function createPromotionDraft(
  context: StaffContext,
  promotionId: string,
  values: FormValues,
  now: Date,
): Saved<string> {
  const draft = await draftOf(context, values);
  if (!draft.ok) {
    return draft;
  }
  const created = await createPromotion(getDb(), {
    promotionId,
    clubId: context.staff.clubId,
    draft: draft.value,
    actor: staffActor(context.staff.id),
    now,
  });
  return created.ok
    ? ok(created.value.promotionId)
    : err(await writeFailure(context, draft.value, created.error, now));
}

export interface PromotionEdit {
  readonly promotionId: string;
  readonly lockToken: string;
  readonly values: FormValues;
}

/** يحفظ تعديل عرض. يرجع هل صار مستنفدًا بالحد الجديد. */
export async function savePromotion(
  context: StaffContext,
  edit: PromotionEdit,
  now: Date,
): Saved<{ readonly exhausted: boolean }> {
  const draft = await draftOf(context, edit.values);
  if (!draft.ok) {
    return draft;
  }
  const updated = await updatePromotion(getDb(), {
    promotionId: edit.promotionId,
    clubId: context.staff.clubId,
    lockToken: edit.lockToken,
    draft: draft.value,
    actor: staffActor(context.staff.id),
    now,
  });
  return updated.ok
    ? ok(updated.value)
    : err(await writeFailure(context, draft.value, updated.error, now));
}

export interface PromotionStatusChange {
  readonly promotionId: string;
  readonly lockToken: string;
  readonly action: string;
}

/** تفعيل أو إيقاف مؤقت أو إنهاء. الإجراء رمز من القائمة المغلقة؛ غيره يُرفض قبل أي قراءة. */
export async function changePromotionStatus(
  context: StaffContext,
  change: PromotionStatusChange,
  now: Date,
): Promise<Result<PromotionStatusResult, FormFailure>> {
  if (!isPromotionStatusAction(change.action)) {
    return err(formFailure(INVALID));
  }
  const result = await setPromotionStatus(getDb(), {
    promotionId: change.promotionId,
    clubId: context.staff.clubId,
    lockToken: change.lockToken,
    action: change.action,
    actor: staffActor(context.staff.id),
    now,
  });
  if (result.ok) {
    return ok(result.value);
  }
  // صفحة التأكيد تسمّي الباقات قبل الزر؛ هذا الرفض سباق بعد رسمها، فنصّه بلا اسم
  const zeroes = result.error.reason === AUTOMATIC_ZEROES_SALE;
  return err(zeroes ? formFailure(ZEROES_ON_ACTIVATE) : failureOf(result.error));
}
