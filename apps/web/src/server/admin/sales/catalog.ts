import "server-only";
import {
  changeProductVersion,
  createProduct,
  getCatalogProduct,
  setAddonLinks,
  setProductStatus,
  staffActor,
  updateProductIdentity,
  type CatalogProductDetail,
  type ProductStatusResult,
} from "@masar/db";
import {
  err,
  hasPermission,
  isProductAdminKind,
  isProductStatusAction,
  ok,
  planVersionChange,
  validateProductDraft,
  validateProductIdentity,
  validateProductTerms,
  type ProductTerms,
  type Result,
} from "@masar/domain";
import { getDb } from "../../db";
import {
  failureOf,
  formFailure,
  type FormFailure,
  type FormIntent,
  type FormValues,
} from "../field-form";
import type { StaffContext } from "../session";
import { draftInput, identityInput, termsInput } from "./plan-form";

/**
 * كتابات الكتالوج باسم الموظف (ADMIN_A2_SALES §4): تحقق الشكل والقواعد في المجال، والكتابة والأقفال
 * والتدقيق في `@masar/db`. كل دالة مقيَّدة بنادي الموظف، وترجع أخطاء حقولها ليعرضها النموذج بجانبها.
 */
type Saved<T> = Promise<Result<T, FormFailure>>;

const INVALID = "sales.invalid_request";
const NOT_FOUND = "catalog.product_not_found";

/** ينشئ منتجًا مسودة. `productId` من النموذج: الإرسال الثاني إعادة لا منتج ثانٍ. */
export async function createPlan(
  context: StaffContext,
  productId: string,
  values: FormValues,
  now: Date,
): Saved<string> {
  const draft = validateProductDraft(draftInput(values));
  if (!draft.ok) {
    return err(failureOf(draft.error));
  }
  const created = await createProduct(getDb(), {
    productId,
    clubId: context.staff.clubId,
    draft: draft.value,
    actor: staffActor(context.staff.id),
    now,
  });
  return created.ok ? ok(created.value.productId) : err(failureOf(created.error));
}

export interface PlanEdit {
  readonly productId: string;
  readonly lockToken: string;
  readonly values: FormValues;
}

async function editableProduct(
  context: StaffContext,
  productId: string,
  now: Date,
): Promise<(CatalogProductDetail & { kind: "membership" | "addon" }) | undefined> {
  const product = await getCatalogProduct(getDb(), context.staff.clubId, productId, now);
  if (product === undefined || !isProductAdminKind(product.kind)) {
    return undefined;
  }
  return { ...product, kind: product.kind };
}

/** يحفظ الهوية. يرجع هل تغيّر شيء. */
export async function savePlanIdentity(
  context: StaffContext,
  edit: PlanEdit,
  now: Date,
): Saved<boolean> {
  const product = await editableProduct(context, edit.productId, now);
  if (product === undefined) {
    return err(formFailure(NOT_FOUND));
  }
  const identity = validateProductIdentity(product.kind, identityInput(edit.values));
  if (!identity.ok) {
    return err(failureOf(identity.error));
  }
  const updated = await updateProductIdentity(getDb(), {
    productId: product.id,
    clubId: context.staff.clubId,
    lockToken: edit.lockToken,
    identity: identity.value,
    actor: staffActor(context.staff.id),
    now,
  });
  return updated.ok ? ok(updated.value.changed.length > 0) : err(failureOf(updated.error));
}

export type TermsOutcome =
  /** منتج منشور وتغيير حقيقي: يُعرض للمراجعة قبل التنفيذ. */
  | {
      readonly kind: "review";
      readonly product: CatalogProductDetail;
      readonly terms: ProductTerms;
    }
  | { readonly kind: "saved"; readonly written: "none" | "benefits" | "version" };

function currentTerms(product: CatalogProductDetail): ProductTerms | null {
  const version = product.currentVersion;
  return version === null
    ? null
    : {
        priceMinor: version.price.amountMinor,
        durationMonths: version.durationMonths,
        bonusMonths: version.bonusMonths,
        benefits: version.benefits,
      };
}

/**
 * يحفظ شروط النسخة. المنتج المنشور يمر بخطوة مراجعة أولًا (ما يُحفظ يسري فورًا في الموقع)، ويحتاج
 * `catalog.publish`؛ المسودة تُحفظ مباشرة. الفحص النهائي للحالة والصلاحية تحت قفل الصف في القاعدة.
 */
export async function savePlanTerms(
  context: StaffContext,
  edit: PlanEdit & { readonly intent: FormIntent },
  now: Date,
): Saved<TermsOutcome> {
  const product = await editableProduct(context, edit.productId, now);
  if (product === undefined) {
    return err(formFailure(NOT_FOUND));
  }
  const terms = validateProductTerms(product.kind, termsInput(edit.values));
  if (!terms.ok) {
    return err(failureOf(terms.error));
  }
  const canChangePublished = hasPermission(context.staff.role, "catalog.publish");
  if (product.status === "active" && edit.intent !== "confirm") {
    if (planVersionChange(currentTerms(product), terms.value) === "none") {
      return err(formFailure("catalog.no_changes"));
    }
    return canChangePublished
      ? ok({ kind: "review", product, terms: terms.value })
      : err(formFailure("catalog.publish_required"));
  }
  const changed = await changeProductVersion(getDb(), {
    productId: product.id,
    clubId: context.staff.clubId,
    lockToken: edit.lockToken,
    terms: terms.value,
    canChangePublished,
    actor: staffActor(context.staff.id),
    now,
  });
  return changed.ok
    ? ok({ kind: "saved", written: changed.value.written })
    : err(failureOf(changed.error));
}

/** يستبدل روابط إضافة بالباقات المحدَّدة. */
export async function savePlanLinks(
  context: StaffContext,
  edit: { productId: string; lockToken: string; membershipIds: readonly string[] },
  now: Date,
): Saved<true> {
  const saved = await setAddonLinks(getDb(), {
    ...edit,
    clubId: context.staff.clubId,
    actor: staffActor(context.staff.id),
    now,
  });
  return saved.ok ? ok(true) : err(failureOf(saved.error));
}

export interface PlanStatusChange {
  readonly productId: string;
  readonly lockToken: string;
  readonly action: string;
  readonly confirmLast: boolean;
}

/** نشر أو إخفاء أو أرشفة. الإجراء رمز من القائمة المغلقة؛ غيره يُرفض قبل أي قراءة. */
export async function changePlanStatus(
  context: StaffContext,
  change: PlanStatusChange,
  now: Date,
): Promise<Result<ProductStatusResult, FormFailure>> {
  if (!isProductStatusAction(change.action)) {
    return err(formFailure(INVALID));
  }
  const result = await setProductStatus(getDb(), {
    productId: change.productId,
    clubId: context.staff.clubId,
    lockToken: change.lockToken,
    action: change.action,
    confirmLast: change.confirmLast,
    actor: staffActor(context.staff.id),
    now,
  });
  return result.ok ? ok(result.value) : err(failureOf(result.error));
}
