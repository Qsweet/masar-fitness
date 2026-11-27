import { majorNumber, type MembershipPlan } from "@masar/domain";
import type { Locale } from "@/i18n/locales";
import type { TrackPayload } from "./types";

/** حمولة اشتراك واحد (عرضه وإضافته): السعر من القاعدة بالهللة ثم ريال. */
export function planPayload(plan: MembershipPlan, locale: Locale): Omit<TrackPayload, "eventId"> {
  const price = majorNumber(plan.price.amountMinor);
  return {
    value: price,
    currency: plan.price.currency,
    lines: [{ id: plan.slug, name: plan.name[locale], price }],
  };
}
