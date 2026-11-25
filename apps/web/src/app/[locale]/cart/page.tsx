import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartContents } from "@/components/cart/cart-contents";
import { CartEmpty } from "@/components/cart/cart-empty";
import styles from "@/components/cart/cart.module.css";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { toQuoteView } from "@/components/checkout/quote-view";
import { UnavailableNotice } from "@/components/checkout/unavailable-notice";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { toPlanViews } from "@/components/plans/plan-view";
import { whatsappUrl } from "@/config/club";
import { CART_PATH, ROUTES } from "@/config/routes";
import { getDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { isLocale, localizedPath, type Locale } from "@/i18n/locales";
import { readCart } from "@/server/cart/cookie";
import { parseCartNote, type CartNote } from "@/server/cart/notes";
import { getMembershipPlans } from "@/server/catalog";
import { requireCheckout } from "@/server/checkout/flag";
import { checkoutMetadata } from "@/server/checkout/metadata";
import { getCheckoutQuote } from "@/server/checkout/quote";

type Props = PageProps<"/[locale]/cart">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  requireCheckout();
  const { locale } = await params;
  return isLocale(locale) ? checkoutMetadata(getDictionary(locale).cart.meta.title) : {};
}

/**
 * محتوى السلة: الاشتراك المحفوظ مسعَّرًا من القاعدة الآن. اشتراك لم يعد قابلًا للبيع يُعرض كسلة فارغة
 * بملاحظة، وسياسة لم يحسمها المالك تعني «غير متاح» مع واتساب بلا زر متابعة.
 */
async function CartBody({
  locale,
  slug,
}: {
  readonly locale: Locale;
  readonly slug: string | null;
}) {
  const dictionary = getDictionary(locale);
  const membershipsHref = localizedPath(locale, ROUTES.memberships);
  const plan =
    slug === null
      ? undefined
      : toPlanViews(await getMembershipPlans(), locale, true).find((view) => view.slug === slug);
  const result =
    plan === undefined
      ? undefined
      : await getCheckoutQuote({ slug: plan.slug, addonSlugs: [], couponInput: "" });
  if (plan === undefined || result?.ok !== true) {
    return <CartEmpty labels={dictionary.cart} membershipsHref={membershipsHref} />;
  }
  if (result.value.quote.blockers.length > 0) {
    const { unavailable } = dictionary.checkout;
    const href = whatsappUrl(fill(dictionary.plan.whatsappMessage, { plan: plan.name }));
    return (
      <div className="container section">
        <UnavailableNotice
          title={unavailable.title}
          lead={unavailable.lead}
          primary={{ href, label: unavailable.action, external: true }}
        />
      </div>
    );
  }
  return (
    <CartContents
      plan={plan}
      quote={toQuoteView(result.value.quote, locale)}
      locale={locale}
      checkoutHref={localizedPath(locale, `/checkout/${plan.slug}`)}
      dictionary={dictionary}
    />
  );
}

function Note({ note, locale }: { readonly note: CartNote | undefined; readonly locale: Locale }) {
  return note === undefined ? null : (
    <p role="status" className={styles.note}>
      {getDictionary(locale).cart.notes[note]}
    </p>
  );
}

/** السلة (خلف العلم، بلا فهرسة): الخطوة الأولى من ثلاث قبل البيانات والدفع. */
export default async function CartPage({ params, searchParams }: Props) {
  requireCheckout();
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const [cart, query] = await Promise.all([readCart(), searchParams]);
  const { cart: labels, steps } = getDictionary(locale);
  return (
    <PageShell locale={locale} path={CART_PATH} mobileAction={null}>
      <PageIntro title={labels.intro.title} lead={labels.intro.lead}>
        <CheckoutSteps current="plan" labels={steps} />
        <Note note={parseCartNote(query.note)} locale={locale} />
      </PageIntro>
      <CartBody locale={locale} slug={cart.slug} />
    </PageShell>
  );
}
