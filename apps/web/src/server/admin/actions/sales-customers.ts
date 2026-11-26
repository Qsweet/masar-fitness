"use server";

import type { PhoneRevealTarget } from "@masar/db";
import { redirect } from "next/navigation";
import { customerPath } from "@/config/admin";
import { failed, idField, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { lookupCustomer, revealPhone } from "../sales/customers";
import type { RevealState } from "../sales/form-state";

const INVALID = "sales.invalid_request";
/** أطول ما يُكتب به جوال (بادئة دولية ومسافات وشرطات)؛ الأطول يُرفض قبل أي تحليل. */
const MOBILE_INPUT_LENGTH = 32;
const SOURCE_INPUT_LENGTH = 16;

/**
 * البحث بالجوال الكامل: POST، فالرقم لا يدخل رابطًا ولا سجل وصول. المطابقة تامة، والنتيجة تحويل إلى
 * صفحة العميل بمعرّفه لا برقمه.
 */
export async function lookupCustomerAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("customers.read");
  const mobile = textField(formData, "mobile", MOBILE_INPUT_LENGTH);
  const found = await lookupCustomer(context, mobile);
  if (!found.ok) {
    return failed(found.error.reason);
  }
  redirect(customerPath(found.value));
}

function revealTarget(formData: FormData): PhoneRevealTarget | null {
  const source = textField(formData, "source", SOURCE_INPUT_LENGTH);
  const id = idField(formData, "id");
  if (id === null) {
    return null;
  }
  if (source === "order") {
    return { source, orderId: id };
  }
  return source === "customer" ? { source, customerId: id } : null;
}

/**
 * كشف الجوال الكامل: الرقم يرجع في حالة النموذج فقط، وكل كشف يكتب سطر تدقيق باسم الموظف في المعاملة
 * نفسها. من لا يملك الصلاحية يرد عليه الحارس 404.
 */
export async function revealPhoneAction(
  _previous: RevealState,
  formData: FormData,
): Promise<RevealState> {
  const context = await requireStaff("customers.reveal_phone");
  const target = revealTarget(formData);
  if (target === null) {
    return { error: INVALID, phone: null };
  }
  const revealed = await revealPhone(context, target, new Date());
  return revealed.ok
    ? { error: null, phone: revealed.value }
    : { error: revealed.error.reason, phone: null };
}
