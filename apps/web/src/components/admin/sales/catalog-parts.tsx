import type { ProductStatus, PromotionDisplayState } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { Badge, type Tone } from "../ui/kit";

/** شارات الكتالوج والعروض: الحالة ولونها من مصدر واحد تستعمله القوائم والتفصيل والتأكيد. */
type Statuses = AdminDictionary["sales"]["statuses"];

const PRODUCT_TONES: Readonly<Record<ProductStatus, Tone>> = {
  draft: "warning",
  active: "success",
  archived: "neutral",
};

export function ProductStatusBadge({
  status,
  statuses,
}: {
  readonly status: ProductStatus;
  readonly statuses: Statuses;
}) {
  return <Badge tone={PRODUCT_TONES[status]}>{statuses.product[status]}</Badge>;
}

const PROMOTION_TONES: Readonly<Record<PromotionDisplayState, Tone>> = {
  draft: "warning",
  scheduled: "info",
  running: "success",
  paused: "warning",
  ended: "neutral",
  exhausted: "neutral",
  archived: "neutral",
};

export function PromotionStateBadge({
  state,
  statuses,
}: {
  readonly state: PromotionDisplayState;
  readonly statuses: Statuses;
}) {
  return <Badge tone={PROMOTION_TONES[state]}>{statuses.promotionState[state]}</Badge>;
}
