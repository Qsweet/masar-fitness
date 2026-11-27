import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";
import type { LocalizedText } from "../membership-plan";
import type { ProductKind, ProductStatus } from "./sellable";

export const PRODUCT_STATUS_ACTIONS = ["publish", "unpublish", "archive"] as const;
export type ProductStatusAction = (typeof PRODUCT_STATUS_ACTIONS)[number];

export function isProductStatusAction(value: unknown): value is ProductStatusAction {
  return PRODUCT_STATUS_ACTIONS.some((action) => action === value);
}

export interface ProductStatusDecision {
  readonly to: ProductStatus;
  /** الحالة مطابقة من قبل (إرسال مزدوج): لا كتابة ولا سطر تدقيق ثانٍ. */
  readonly replay: boolean;
}

const TARGET: Readonly<Record<ProductStatusAction, ProductStatus>> = {
  publish: "active",
  unpublish: "draft",
  archive: "archived",
};

const ALLOWED_FROM: Readonly<Record<ProductStatusAction, readonly ProductStatus[]>> = {
  publish: ["draft", "archived"],
  unpublish: ["active"],
  archive: ["active", "draft"],
};

/** انتقالات حالة المنتج (§4.3): نشر، إخفاء، أرشفة. المؤرشف يُنشر من جديد ولا يُخفى. */
export function decideProductStatus(
  current: ProductStatus,
  action: ProductStatusAction,
): Result<ProductStatusDecision, DomainError> {
  const to = TARGET[action];
  if (current === to) {
    return ok({ to, replay: true });
  }
  if (!ALLOWED_FROM[action].includes(current)) {
    return err(new DomainError("conflict", "catalog.status_not_allowed"));
  }
  return ok({ to, replay: false });
}

export const PUBLISH_BLOCKERS = [
  "no_current_version",
  "membership_without_duration",
  "texts_incomplete",
] as const;
export type PublishBlocker = (typeof PUBLISH_BLOCKERS)[number];

/** تنبيه لا يمنع النشر: إضافة بلا باقة مرتبطة لا تُعرض في أي سلة. */
export const PUBLISH_WARNINGS = ["addon_unlinked"] as const;
export type PublishWarning = (typeof PUBLISH_WARNINGS)[number];

export interface PublishFacts {
  readonly kind: ProductKind;
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  readonly currentVersion: { readonly durationMonths: number | null } | null;
  /** عدد الباقات المرتبطة بالإضافة؛ يُهمل لغير الإضافة. */
  readonly linkedPlans: number;
}

export interface PublishReadiness {
  readonly blockers: readonly PublishBlocker[];
  readonly warnings: readonly PublishWarning[];
}

type ProductTextField = "nameAr" | "nameEn" | "summaryAr" | "summaryEn";

/**
 * حقول نصوص المنتج الفارغة: المنتج المنشور نصوصه كاملة باللغتين. تعريف واحد يمنع النشر بنص ناقص
 * ويمنع تفريغ نص منتج منشور.
 */
function missingTexts(texts: {
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
}): readonly ProductTextField[] {
  const values: readonly (readonly [ProductTextField, string])[] = [
    ["nameAr", texts.name.ar],
    ["nameEn", texts.name.en],
    ["summaryAr", texts.summary.ar],
    ["summaryEn", texts.summary.en],
  ];
  return values.filter(([, text]) => text.trim() === "").map(([field]) => field);
}

/** هوية منتج منشور: لا يُفرَّغ نص منه، وإلا صار ما يعرضه الموقع ناقصًا. */
export function checkPublishedTexts(
  status: ProductStatus,
  texts: { readonly name: LocalizedText; readonly summary: LocalizedText },
): Result<true, DomainError> {
  const missing = status === "active" ? missingTexts(texts) : [];
  const [field] = missing;
  return field === undefined
    ? ok(true)
    : err(new DomainError("validation", "catalog.texts_required_published", { field }));
}

/** ما يمنع نشر المنتج وما يُنبَّه إليه: نسخة سارية، ومدة للاشتراك، ونصوص باللغتين. */
export function publishBlockers(facts: PublishFacts): PublishReadiness {
  const failed: Readonly<Record<PublishBlocker, boolean>> = {
    no_current_version: facts.currentVersion === null,
    membership_without_duration:
      facts.kind === "membership" && facts.currentVersion?.durationMonths === null,
    texts_incomplete: missingTexts(facts).length > 0,
  };
  return {
    blockers: PUBLISH_BLOCKERS.filter((blocker) => failed[blocker]),
    warnings: facts.kind === "addon" && facts.linkedPlans === 0 ? ["addon_unlinked"] : [],
  };
}
