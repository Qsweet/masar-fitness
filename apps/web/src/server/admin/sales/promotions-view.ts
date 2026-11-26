import type { PromotionAdminRow } from "@masar/db";
import {
  PROMOTION_DISPLAY_STATES,
  type PromotionDiscount,
  type PromotionDisplayState,
} from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { formatAmount, formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { formatRate } from "./catalog-view";

/** نصوص العروض كما تُعرض في القائمة والتفصيل والتأكيد. تركيب نصوص فقط: الأرقام من القاعدة والمجال. */
type PromotionsText = AdminDictionary["sales"]["promotions"];

export const PROMOTION_TABS = ["all", ...PROMOTION_DISPLAY_STATES] as const;
export type PromotionTab = (typeof PROMOTION_TABS)[number];

export function parsePromotionTab(value: string | string[] | undefined): PromotionTab {
  return PROMOTION_TABS.find((tab) => tab === value) ?? "all";
}

export function rowsOfTab(
  rows: readonly PromotionAdminRow[],
  tab: PromotionTab,
): readonly PromotionAdminRow[] {
  return tab === "all" ? rows : rows.filter((row) => row.state === tab);
}

export function countByState(
  rows: readonly PromotionAdminRow[],
): Readonly<Record<PromotionDisplayState, number>> {
  const count = (state: PromotionDisplayState): number =>
    rows.filter((row) => row.state === state).length;
  return Object.fromEntries(
    PROMOTION_DISPLAY_STATES.map((state) => [state, count(state)]),
  ) as Record<PromotionDisplayState, number>;
}

/** «10%» أو «50 ر.س». */
export function discountText(discount: PromotionDiscount): string {
  return discount.kind === "percentage" ? formatRate(discount.rate) : formatAmount(discount.amount);
}

export function windowText(
  rule: PromotionAdminRow["rule"],
  timezone: string,
  text: PromotionsText,
): string {
  const from = formatDateTime(rule.startsAt, timezone);
  return rule.endsAt === null
    ? fill(text.windowOpen, { from })
    : fill(text.windowBounded, { from, until: formatDateTime(rule.endsAt, timezone) });
}

/** الاستخدام النشط من الحد الكلي: «3 من 100» أو «3، بلا حد». */
export function usageText(row: PromotionAdminRow, text: PromotionsText): string {
  const used = formatNumber(row.usage.active);
  const limit = row.rule.maxRedemptions;
  return limit === null
    ? fill(text.usageUnlimited, { used })
    : fill(text.usageLimited, { used, limit: formatNumber(limit) });
}

export function limitText(limit: number | null, text: PromotionsText): string {
  return limit === null ? text.detail.unlimited : formatNumber(limit);
}

export function scopeText(row: PromotionAdminRow, text: PromotionsText): string {
  if (row.rule.scope.kind === "all_products") {
    return text.form.scopes.all_products;
  }
  const names = row.products.map((product) => product.name.ar).join("، ");
  return names === "" ? text.form.scopes.listed_products : names;
}

/** شروط العرض «التسمية: القيمة»: بطاقة التفصيل، وما يُعاد عرضه في تأكيد التفعيل. */
export function promotionFacts(
  row: PromotionAdminRow,
  timezone: string,
  dictionary: AdminDictionary,
): (readonly [string, string])[] {
  const text = dictionary.sales.promotions;
  const { rule } = row;
  const labels = text.detail;
  return [
    [labels.type, rule.code === null ? text.types.automatic : text.types.coupon],
    [labels.code, rule.code ?? text.noCode],
    [labels.discount, discountText(rule.discount)],
    [labels.scope, scopeText(row, text)],
    [labels.audience, labels.audiences[rule.audience]],
    [labels.window, windowText(rule, timezone, text)],
    [labels.maxRedemptions, limitText(rule.maxRedemptions, text)],
    [labels.maxPerCustomer, limitText(rule.maxRedemptionsPerCustomer, text)],
    [labels.stackable, rule.stackable ? dictionary.common.yes : dictionary.common.no],
  ];
}
