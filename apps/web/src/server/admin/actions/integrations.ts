"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { integrationPath } from "@/config/admin";
import { failed, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { saveIntegrationForm } from "../integrations/save";
import { sendTestFromAdmin } from "../integrations/test-event";

const MAX_PROVIDER_LENGTH = 32;

/** حفظ إعداد منصة (ADMIN_A5_TRACKING §8). المفتاح الخادمي يحتاج `integrations.secrets` فوق هذا. */
export async function saveIntegrationAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("integrations.manage");
  const outcome = await saveIntegrationForm(context, formData);
  if (outcome.kind === "rejected") {
    return failed(outcome.reason);
  }
  const done = outcome.kind === "saved" ? "tracking_saved" : "tracking_unchanged";
  redirect(`${integrationPath(outcome.provider)}?done=${done}`);
}

/** «أرسل حدث اختبار»: النتيجة في السجل أسفل الصفحة، والرفض برسالة سببه. */
export async function sendTestEventAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("integrations.manage");
  const provider = textField(formData, "provider", MAX_PROVIDER_LENGTH);
  const failure = await sendTestFromAdmin(context, provider);
  if (failure !== null) {
    // الرفض سُجّل في السجل أسفل الصفحة: تُعاد قراءتها ليظهر
    revalidatePath(integrationPath(provider));
    return failed(failure);
  }
  redirect(`${integrationPath(provider)}?done=tracking_test_sent`);
}
