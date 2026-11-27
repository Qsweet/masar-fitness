"use server";

import { redirect } from "next/navigation";
import { planPath } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import {
  formFailure,
  formIntent,
  readFormValues,
  rejectedForm,
  reviewForm,
  type FieldFormState,
} from "../field-form";
import { failed, idField, idListField, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import {
  changePlanStatus,
  createPlan,
  savePlanIdentity,
  savePlanLinks,
  savePlanTerms,
} from "../sales/catalog";
import { termsReview } from "../sales/catalog-view";
import { CREATE_LIMITS, IDENTITY_LIMITS, TERMS_LIMITS } from "../sales/plan-form";

const INVALID = "sales.invalid_request";
const TOKEN_INPUT_LENGTH = 80;
const CODE_INPUT_LENGTH = 32;
const MAX_LINKS = 200;

function done(productId: string, notice: string, tab?: string): never {
  const query = new URLSearchParams({ ...(tab === undefined ? {} : { tab }), done: notice });
  redirect(`${planPath(productId)}?${query.toString()}`);
}

/** إنشاء منتج مسودة. المعرّف من النموذج: الإرسال الثاني ينتهي بالمنتج نفسه. */
export async function createPlanAction(
  _previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("catalog.write");
  const values = readFormValues(formData, CREATE_LIMITS);
  const productId = idField(formData, "productId");
  if (productId === null) {
    return rejectedForm(values, formFailure(INVALID));
  }
  const created = await createPlan(context, productId, values, new Date());
  if (!created.ok) {
    return rejectedForm(values, created.error);
  }
  done(created.value, "product_created");
}

/** حفظ الاسمين والوصفين واسم الفئة والترتيب. */
export async function savePlanIdentityAction(
  _previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("catalog.write");
  const values = readFormValues(formData, IDENTITY_LIMITS);
  const productId = idField(formData, "productId");
  if (productId === null) {
    return rejectedForm(values, formFailure(INVALID));
  }
  const lockToken = textField(formData, "lockToken", TOKEN_INPUT_LENGTH);
  const saved = await savePlanIdentity(context, { productId, lockToken, values }, new Date());
  if (!saved.ok) {
    return rejectedForm(values, saved.error);
  }
  done(productId, saved.value ? "product_updated" : "product_unchanged");
}

const TERMS_NOTICES = {
  none: "product_unchanged",
  benefits: "product_benefits_updated",
  version: "product_version_created",
} as const;

/**
 * حفظ السعر والمدة والمزايا. المنتج المنشور يمر بخطوة مراجعة يعيد فيها الخادم عرض القديم والجديد،
 * ولا يُنفَّذ إلا بعد التأكيد.
 */
export async function savePlanTermsAction(
  previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("catalog.write");
  const intent = formIntent(formData);
  const values = readFormValues(formData, TERMS_LIMITS);
  const productId = idField(formData, "productId");
  if (productId === null) {
    return rejectedForm(values, formFailure(INVALID));
  }
  if (intent === "edit") {
    return rejectedForm(previous.values, { error: null, fields: {} });
  }
  const lockToken = textField(formData, "lockToken", TOKEN_INPUT_LENGTH);
  const saved = await savePlanTerms(context, { productId, lockToken, values, intent }, new Date());
  if (!saved.ok) {
    return rejectedForm(values, saved.error);
  }
  if (saved.value.kind === "review") {
    const text = getAdminDictionary().sales.plans;
    return reviewForm(values, termsReview(saved.value.product, saved.value.terms, text));
  }
  done(productId, TERMS_NOTICES[saved.value.written], "pricing");
}

/** استبدال روابط إضافة بالباقات المحدَّدة في النموذج. */
export async function savePlanLinksAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("catalog.write");
  const productId = idField(formData, "productId");
  const membershipIds = idListField(formData, "membershipIds", MAX_LINKS);
  if (productId === null || membershipIds === null) {
    return failed(INVALID);
  }
  const lockToken = textField(formData, "lockToken", TOKEN_INPUT_LENGTH);
  const saved = await savePlanLinks(context, { productId, lockToken, membershipIds }, new Date());
  if (!saved.ok) {
    return failed(saved.error.error ?? INVALID);
  }
  done(productId, "product_addon_links_updated");
}

const STATUS_NOTICES = {
  active: "product_published",
  draft: "product_unpublished",
  archived: "product_archived",
} as const;

/** نشر أو إخفاء أو أرشفة، من صفحة التأكيد. إخفاء آخر باقة تُباع يحتاج خانة تأكيده. */
export async function setPlanStatusAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("catalog.publish");
  const productId = idField(formData, "productId");
  if (productId === null) {
    return failed(INVALID);
  }
  const changed = await changePlanStatus(
    context,
    {
      productId,
      lockToken: textField(formData, "lockToken", TOKEN_INPUT_LENGTH),
      action: textField(formData, "action", CODE_INPUT_LENGTH),
      confirmLast: formData.get("confirmLast") === "yes",
    },
    new Date(),
  );
  if (!changed.ok) {
    return failed(changed.error.error ?? INVALID);
  }
  done(productId, STATUS_NOTICES[changed.value.status]);
}
