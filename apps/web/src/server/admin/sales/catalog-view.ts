import type { CatalogProductDetail } from "@masar/db";
import {
  basisPoints,
  bestValuePlan,
  money,
  vatIncludedIn,
  type MembershipPlan,
  type Money,
  type ProductTerms,
} from "@masar/domain";
import { toPlanViews, type PlanView } from "@/components/plans/plan-view";
import type { AdminDictionary } from "@/i18n/admin";
import { formatAmount } from "@/i18n/admin/format";
import { formatMonths } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import type { FieldFormState } from "../field-form";
import { percentInput } from "./promotion-form";

/**
 * نماذج عرض الكتالوج في اللوحة. الحساب كله في `@masar/domain` (الضريبة المتضمَّنة، الأكثر قيمة)، وهنا
 * تركيب النصوص فقط. بلا اعتماد على الخادم، فيُختبر بلا Next ولا قاعدة.
 */
/** نسبة بنقاط الأساس كما تُكتب: «15%» أو «12.5%». */
export function formatRate(bps: number): string {
  return `${percentInput(bps)}%`;
}

/** ضريبة القيمة المضافة المتضمَّنة في سعر شامل لها، بنسبة النادي. */
export function includedVat(price: Money, vatRateBps: number): Money {
  return vatIncludedIn(price, basisPoints(vatRateBps));
}

/** المنتج كما يُعرض للبيع لو كان منشورًا الآن: مدخل البطاقة العامة. undefined بلا نسخة سارية ومدة. */
export function planOf(product: CatalogProductDetail): MembershipPlan | undefined {
  const version = product.currentVersion;
  const paidMonths = version?.durationMonths ?? null;
  if (product.kind !== "membership" || version === null || paidMonths === null) {
    return undefined;
  }
  return {
    slug: product.slug,
    name: product.name,
    tier: product.tier,
    summary: product.summary,
    price: version.price,
    paidMonths,
    bonusMonths: version.bonusMonths,
    benefits: version.benefits,
  };
}

/**
 * القائمة التي تُحسب عليها شارة «الأكثر قيمة» في المعاينة: الباقات المعروضة في الموقع الآن، وهذه الباقة
 * في موضعها بحالتها الحالية (تحل محل نفسها إن كانت منشورة، وتُضاف إن كانت مسودة).
 */
export function withPreviewed(
  published: readonly MembershipPlan[],
  plan: MembershipPlan,
): MembershipPlan[] {
  const others = published.filter((candidate) => candidate.slug !== plan.slug);
  return published.length === others.length
    ? [...others, plan]
    : published.map((candidate) => (candidate.slug === plan.slug ? plan : candidate));
}

/**
 * نموذج عرض المعاينة: `toPlanViews` العام نفسه على القائمة نفسها، ثم بطاقة هذه الباقة. الشراء مغلق في
 * المعاينة دائمًا: البطاقة للعرض لا للشراء.
 */
export function previewView(
  published: readonly MembershipPlan[],
  plan: MembershipPlan,
  locale: Locale,
): PlanView | undefined {
  return toPlanViews(withPreviewed(published, plan), locale, false).find(
    (view) => view.slug === plan.slug,
  );
}

/** معرّف الباقة التي تحمل شارة «الأكثر قيمة» في الموقع الآن (محسوبة، حين توجد مقارنة). */
export function bestValueSlug(published: readonly MembershipPlan[]): string | undefined {
  return published.length > 1 ? bestValuePlan(published)?.slug : undefined;
}

type PlansText = AdminDictionary["sales"]["plans"];

function durationLabel(months: number | null, text: PlansText): string {
  return months === null ? text.noDuration : formatMonths(months, "ar");
}

function bonusLabel(months: number, text: PlansText): string {
  return months === 0 ? text.detail.noBonus : formatMonths(months, "ar");
}

type Line = readonly [label: string, value: string];

/** القديم والجديد لقيمة واحدة، إن تغيّرت. */
function changedPair(labels: readonly [string, string], was: string, next: string): Line[] {
  return was === next
    ? []
    : [
        [labels[0], was],
        [labels[1], next],
      ];
}

function durationLines(
  product: CatalogProductDetail,
  terms: ProductTerms,
  text: PlansText,
): Line[] {
  if (product.kind !== "membership") {
    return [];
  }
  const current = product.currentVersion;
  const labels = text.termsConfirm;
  return [
    ...changedPair(
      [labels.durationBefore, labels.durationAfter],
      durationLabel(current?.durationMonths ?? null, text),
      durationLabel(terms.durationMonths, text),
    ),
    ...changedPair(
      [labels.bonusBefore, labels.bonusAfter],
      bonusLabel(current?.bonusMonths ?? 0, text),
      bonusLabel(terms.bonusMonths, text),
    ),
  ];
}

/**
 * أسطر مراجعة تغيير الشروط على منتج منشور: القديم والجديد لكل ما تغيّر، وعدد الطلبات المعلّقة التي
 * تبقى بسعرها.
 */
export function termsReview(
  product: CatalogProductDetail,
  terms: ProductTerms,
  text: PlansText,
): FieldFormState["review"] {
  const current = product.currentVersion;
  const labels = text.termsConfirm;
  const benefitsChanged =
    JSON.stringify(current?.benefits ?? []) !== JSON.stringify(terms.benefits);
  return [
    ...changedPair(
      [labels.priceBefore, labels.priceAfter],
      current === null ? text.noVersion : formatAmount(current.price),
      formatAmount(money(terms.priceMinor, current?.price.currency)),
    ),
    ...durationLines(product, terms, text),
    ...(benefitsChanged ? [[labels.benefits, labels.benefitsChanged] as const] : []),
    [labels.pending, String(product.pendingOrders)],
  ];
}
