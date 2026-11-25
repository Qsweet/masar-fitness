import "server-only";
import { MAX_ADDONS_PER_ORDER, MAX_AMOUNT_MINOR } from "@masar/domain";
import { z } from "zod";
import {
  MAX_COUPON_INPUT_LENGTH,
  MAX_MOBILE_INPUT_LENGTH,
  MAX_NAME_INPUT_LENGTH,
} from "@/config/checkout";
import { LOCALES } from "@/i18n/locales";

/** شكل slug المنتج كما في قيد القاعدة `products_slug_shape`. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;
/** الإجمالي بالهللة أرقام فقط بلا إشارة ولا كسور، وطوله يكفي حد int4. */
const MINOR_AMOUNT_PATTERN = /^\d{1,10}$/;

const slugSchema = z.string().max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN);

/** حقول النموذج كما تصل: نصوص فقط، والأطوال حماية من المدخلات الضخمة قبل التحقق الحقيقي. */
const checkoutFormSchema = z.object({
  name: z.string().max(MAX_NAME_INPUT_LENGTH),
  mobile: z.string().max(MAX_MOBILE_INPUT_LENGTH),
  coupon: z.string().max(MAX_COUPON_INPUT_LENGTH).default(""),
  idempotencyKey: z.uuid(),
  quotedTotalMinor: z
    .string()
    .regex(MINOR_AMOUNT_PATTERN)
    .transform(Number)
    .pipe(z.number().int().min(0).max(MAX_AMOUNT_MINOR)),
  addons: z.array(slugSchema).max(MAX_ADDONS_PER_ORDER),
  locale: z.enum(LOCALES),
  slug: slugSchema,
});

export type CheckoutForm = z.infer<typeof checkoutFormSchema>;

/** حقول النموذج التي يظهر الخطأ بجانبها، و`form` لما لا حقل له. */
export type CheckoutField = "name" | "mobile" | "coupon" | "form";

export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;

/** أول خطأ لكل حقل ظاهر؛ أي حقل مخفي عُبث به خطأ عام على النموذج. */
const FIELD_REASONS: Readonly<Record<string, readonly [CheckoutField, string]>> = {
  name: ["name", "buyer.name_too_long"],
  mobile: ["mobile", "mobile.not_saudi_mobile"],
  coupon: ["coupon", "coupon.invalid_format"],
};

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function rawForm(formData: FormData) {
  return {
    name: text(formData, "name"),
    mobile: text(formData, "mobile"),
    coupon: text(formData, "coupon"),
    idempotencyKey: text(formData, "idempotencyKey"),
    quotedTotalMinor: text(formData, "quotedTotalMinor"),
    addons: formData.getAll("addon"),
    locale: text(formData, "locale"),
    slug: text(formData, "slug"),
  };
}

function toFieldErrors(issues: readonly z.core.$ZodIssue[]): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  for (const issue of issues) {
    const [field, reason] = FIELD_REASONS[String(issue.path[0])] ?? ["form", "form.invalid"];
    errors[field] ??= reason;
  }
  return errors;
}

export type CheckoutFormResult =
  | { readonly ok: true; readonly value: CheckoutForm }
  | { readonly ok: false; readonly errors: CheckoutFieldErrors };

/** يتحقق من شكل النموذج وأطواله فقط؛ صحة الاسم والجوال والكوبون في المجال بعده. */
export function parseCheckoutForm(formData: FormData): CheckoutFormResult {
  const parsed = checkoutFormSchema.safeParse(rawForm(formData));
  if (!parsed.success) {
    return { ok: false, errors: toFieldErrors(parsed.error.issues) };
  }
  return { ok: true, value: parsed.data };
}

/** الاسم والجوال كما كتبهما الزائر، لإعادتهما في النموذج مع الخطأ. */
export function typedValues(formData: FormData): { name: string; mobile: string } {
  return {
    name: (text(formData, "name") ?? "").slice(0, MAX_NAME_INPUT_LENGTH),
    mobile: (text(formData, "mobile") ?? "").slice(0, MAX_MOBILE_INPUT_LENGTH),
  };
}

export interface CheckoutOptions {
  readonly addonSlugs: readonly string[];
  readonly couponInput: string;
}

type SearchValue = string | string[] | undefined;

function asList(value: SearchValue): string[] {
  return value === undefined ? [] : [value].flat();
}

export function isSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

/**
 * خيارات صفحة الشراء من الرابط (نموذج GET): `addon` متكرر و`coupon`. slug بشكل غريب ⇒ undefined
 * (404)؛ عدد الإضافات وصلاحيتها وصيغة الكوبون يحكم بها عرض السعر نفسه.
 */
export function parseCheckoutOptions(
  searchParams: Readonly<Record<string, SearchValue>>,
): CheckoutOptions | undefined {
  const addons = asList(searchParams.addon);
  if (!addons.every(isSlug)) {
    return undefined;
  }
  const [coupon = ""] = asList(searchParams.coupon);
  // الأطول من الحد يبقى أطول من صيغة الكوبون فيُرفض بخطأ الصيغة، دون حمل نص ضخم
  return {
    addonSlugs: [...new Set(addons)],
    couponInput: coupon.slice(0, MAX_COUPON_INPUT_LENGTH + 1),
  };
}
