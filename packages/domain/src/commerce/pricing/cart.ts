import type { LocalizedText } from "../../catalog/membership-plan";
import { DomainError } from "../../errors";
import type { Money } from "../../money";
import { err, ok, type Result } from "../../result";
import { MAX_ADDONS_PER_ORDER } from "./limits";

export type PurchasableKind = "membership" | "digital_program" | "addon";

/** سطر سلة من النسخة السارية للمنتج: سعرها ومدتها ومزاياها كما ستُختم في الطلب. */
export interface CartLine {
  readonly productId: string;
  readonly versionId: string;
  readonly kind: PurchasableKind;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  readonly benefits: readonly LocalizedText[];
  /** سعر القائمة شامل الضريبة */
  readonly listPrice: Money;
  readonly paidMonths: number | null;
  readonly bonusMonths: number;
  readonly sortOrder: number;
}

export interface CartInput {
  readonly primary: CartLine;
  readonly addons: readonly CartLine[];
  /** منتجات الإضافات المرتبطة بالسطر الأساسي في `product_addons`. */
  readonly attachableAddonProductIds: readonly string[];
}

function invalid(reason: string): Result<never, DomainError> {
  return err(new DomainError("validation", reason));
}

/** ترتيب الإضافات الثابت: `sortOrder` ثم slug بمقارنة نصية حرفية لا تتأثر بالمحلية. */
function byDisplayOrder(a: CartLine, b: CartLine): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  if (a.slug === b.slug) {
    return 0;
  }
  return a.slug < b.slug ? -1 : 1;
}

function checkAddons(input: CartInput): Result<true, DomainError> {
  const { primary, addons } = input;
  if (primary.kind === "addon" || (addons.length > 0 && primary.kind !== "membership")) {
    return invalid("cart.addon_requires_membership");
  }
  if (addons.some((addon) => addon.kind !== "addon")) {
    throw new DomainError("invariant", "cart.addon_line_kind_mismatch");
  }
  if (addons.some((addon) => !input.attachableAddonProductIds.includes(addon.productId))) {
    return invalid("cart.addon_not_attachable");
  }
  if (new Set(addons.map((addon) => addon.productId)).size !== addons.length) {
    return invalid("cart.addon_duplicate");
  }
  if (addons.length > MAX_ADDONS_PER_ORDER) {
    return invalid("cart.too_many_addons");
  }
  return ok(true);
}

/** رمز العملة كنص عام: القيم تصل من القاعدة، فالمقارنة فحص فعلي وقت التشغيل. */
export function lineCurrency(line: CartLine): string {
  return line.listPrice.currency;
}

function isPositiveInteger(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value > 0;
}

/** ثوابت يضمنها من يبني السطور من القاعدة؛ خرقها عطل لا خطأ عميل. */
function assertLineInvariants(primary: CartLine, lines: readonly CartLine[]): void {
  if (lines.some((line) => lineCurrency(line) !== lineCurrency(primary))) {
    throw new DomainError("invariant", "cart.currency_mismatch");
  }
  if (primary.kind === "membership" && !isPositiveInteger(primary.paidMonths)) {
    throw new DomainError("invariant", "cart.membership_without_months");
  }
}

/**
 * يتحقق من تركيب السلة ويرجع سطورها مرتبة: الأساسي أولًا ثم الإضافات بترتيب العرض.
 * الإضافة لا تُشترى إلا مع باقة اشتراك، ومن الإضافات المرتبطة بها فقط.
 */
export function validateCart(input: CartInput): Result<readonly CartLine[], DomainError> {
  const addonsCheck = checkAddons(input);
  if (!addonsCheck.ok) {
    return addonsCheck;
  }
  const lines = [input.primary, ...[...input.addons].sort(byDisplayOrder)];
  assertLineInvariants(input.primary, lines);
  return ok(lines);
}
