import { monthlyEquivalent, type MembershipPlan } from "@masar/domain";
import { ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import { whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import { moneyParts, roundedMoneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

interface PurchaseProps {
  readonly plan: MembershipPlan;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/**
 * رابط الشراء الحالي: واتساب النادي برسالة تسمّي الباقة (مسار البيع القائم فعلًا).
 * يُستبدل بالدفع الإلكتروني في المرحلتين 3 و4، ويبقى واتساب بديلًا.
 */
export function purchaseUrl({ plan, locale, dictionary }: PurchaseProps): string {
  return whatsappUrl(`${dictionary.plan.whatsappMessage} «${plan.name[locale]}».`);
}

/** لوحة الشراء على سطح فاتح: الإجمالي الواجب دفعه واضح قبل أي ضغطة. */
export function PurchasePanel(props: PurchaseProps) {
  const { plan, locale, dictionary } = props;
  return (
    <div className="surface-chalk surface-chalk-raised rule border p-6 md:p-8">
      <p className="text-muted text-small font-medium">{dictionary.plans.total}</p>
      <p className="mt-1 text-title font-display">
        <Price parts={moneyParts(plan.price, locale)} unitClassName="text-heading font-strong" />
      </p>
      <p className="text-muted text-small">{dictionary.plans.vatIncluded}</p>
      <p className="text-muted mt-3">
        {dictionary.plans.about}{" "}
        <Price parts={roundedMoneyParts(monthlyEquivalent(plan), locale)} />{" "}
        {dictionary.plans.perMonth}
      </p>
      <ButtonLink href={purchaseUrl(props)} external className="mt-6 w-full">
        {dictionary.plan.buyWhatsapp}
      </ButtonLink>
      <p className="text-muted mt-4 text-small">{dictionary.plan.buyNote}</p>
    </div>
  );
}

/** شريط شراء ثابت أسفل الجوال: السعر والزر دائمًا في متناول الإبهام. */
export function StickyPurchaseBar(props: PurchaseProps) {
  const { plan, locale, dictionary } = props;
  return (
    <aside
      aria-label={dictionary.plan.stickyLabel}
      className="surface-asphalt fixed inset-x-0 bottom-0 z-10 shadow-bar md:hidden"
    >
      <div className="page-container flex items-center justify-between gap-4 py-3">
        <p>
          <span className="block text-small text-muted">{plan.name[locale]}</span>
          <Price parts={moneyParts(plan.price, locale)} className="text-heading font-display" />
        </p>
        <ButtonLink href={purchaseUrl(props)} external>
          {dictionary.plan.buyWhatsapp}
        </ButtonLink>
      </div>
    </aside>
  );
}
