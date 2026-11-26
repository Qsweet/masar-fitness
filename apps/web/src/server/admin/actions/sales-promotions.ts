"use server";

import { redirect } from "next/navigation";
import { promotionPath } from "@/config/admin";
import { formFailure, rejectedForm, type FieldFormState } from "../field-form";
import { failed, idField, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { promotionValues } from "../sales/promotion-form";
import { changePromotionStatus, createPromotionDraft, savePromotion } from "../sales/promotions";

const INVALID = "sales.invalid_request";
const TOKEN_INPUT_LENGTH = 32;
const CODE_INPUT_LENGTH = 32;

function done(promotionId: string, notice: string): never {
  redirect(`${promotionPath(promotionId)}?done=${notice}`);
}

/** إنشاء عرض مسودة. المعرّف من النموذج: الإرسال الثاني ينتهي بالعرض نفسه. */
export async function createPromotionAction(
  _previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("promotions.write");
  const values = promotionValues(formData);
  const promotionId = idField(formData, "promotionId");
  if (promotionId === null) {
    return rejectedForm(values, formFailure(INVALID));
  }
  const created = await createPromotionDraft(context, promotionId, values, new Date());
  if (!created.ok) {
    return rejectedForm(values, created.error);
  }
  done(created.value, "promotion_created");
}

/** حفظ تعديل عرض بحسب سياسة التعديل (ما جُمِّد بعد أول استخدام يُرفض تغييره). */
export async function savePromotionAction(
  _previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("promotions.write");
  const values = promotionValues(formData);
  const promotionId = idField(formData, "promotionId");
  if (promotionId === null) {
    return rejectedForm(values, formFailure(INVALID));
  }
  const lockToken = textField(formData, "lockToken", TOKEN_INPUT_LENGTH);
  const saved = await savePromotion(context, { promotionId, lockToken, values }, new Date());
  if (!saved.ok) {
    return rejectedForm(values, saved.error);
  }
  done(promotionId, saved.value.exhausted ? "promotion_updated_exhausted" : "promotion_updated");
}

const STATUS_NOTICES = {
  active: "promotion_activated",
  paused: "promotion_paused",
  archived: "promotion_ended",
  draft: "promotion_updated",
} as const;

/** تفعيل أو إيقاف مؤقت أو إنهاء، من صفحة التأكيد. */
export async function setPromotionStatusAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("promotions.write");
  const promotionId = idField(formData, "promotionId");
  if (promotionId === null) {
    return failed(INVALID);
  }
  const changed = await changePromotionStatus(
    context,
    {
      promotionId,
      lockToken: textField(formData, "lockToken", TOKEN_INPUT_LENGTH),
      action: textField(formData, "action", CODE_INPUT_LENGTH),
    },
    new Date(),
  );
  if (!changed.ok) {
    return failed(changed.error.error ?? INVALID);
  }
  done(promotionId, STATUS_NOTICES[changed.value.status]);
}
