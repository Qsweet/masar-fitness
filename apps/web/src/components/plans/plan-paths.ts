import type { MembershipPlan } from "@masar/domain";
import { whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";

/** رابط صفحة الباقة: لكل باقة صفحة حقيقية، واختيار المدة تنقّل إليها. */
export function planHref(plan: MembershipPlan, locale: Locale): string {
  return localizedPath(locale, `/memberships/${plan.slug}`);
}

/**
 * رابط الشراء الحالي: واتساب النادي برسالة تسمّي الباقة (مسار البيع القائم فعلًا).
 * يُستبدل بالدفع الإلكتروني في المرحلتين 3 و4، ويبقى واتساب بديلًا (القرار 18).
 */
export function purchaseUrl(plan: MembershipPlan, locale: Locale, dictionary: Dictionary): string {
  return whatsappUrl(dictionary.plan.whatsappMessage.replace("{plan}", plan.name[locale]));
}
