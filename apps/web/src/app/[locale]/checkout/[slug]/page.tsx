import type { DomainError } from "@masar/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailsForm } from "@/components/checkout/details-form";
import { errorText } from "@/components/checkout/error-text";
import { OptionsForm } from "@/components/checkout/options-form";
import { QuoteSummary } from "@/components/checkout/quote-summary";
import { addonChoices, couponMessage, toQuoteView } from "@/components/checkout/quote-view";
import { UnavailableNotice } from "@/components/checkout/unavailable-notice";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { whatsappUrl } from "@/config/club";
import { getDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { isLocale, localizedPath, type Locale } from "@/i18n/locales";
import { requireCheckout } from "@/server/checkout/flag";
import { isSlug, parseCheckoutOptions, type CheckoutOptions } from "@/server/checkout/form-schema";
import { initialCheckoutState } from "@/server/checkout/form-state";
import { checkoutMetadata } from "@/server/checkout/metadata";
import { getCheckoutQuote, type CheckoutQuote } from "@/server/checkout/quote";
import { cx } from "@/lib/cx";
import styles from "./page.module.css";

type Props = PageProps<"/[locale]/checkout/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  requireCheckout();
  const { locale } = await params;
  return isLocale(locale) ? checkoutMetadata(getDictionary(locale).checkout.meta.title) : {};
}

interface BodyProps {
  readonly locale: Locale;
  readonly slug: string;
  readonly options: CheckoutOptions;
}

function planWhatsapp(locale: Locale, planName: string): string {
  return whatsappUrl(fill(getDictionary(locale).plan.whatsappMessage, { plan: planName }));
}

/** سلة لا تُسعَّر (إضافة لا تخص الباقة، عدد زائد…): السبب بصدق وبداية نظيفة، بلا نموذج. */
function QuoteProblem({
  locale,
  slug,
  error,
}: Omit<BodyProps, "options"> & { error: DomainError }) {
  const dictionary = getDictionary(locale);
  const { unavailable } = dictionary.checkout;
  return (
    <div className="container section">
      <UnavailableNotice
        title={unavailable.problemTitle}
        lead={errorText(error.reason, dictionary)}
        primary={{ href: localizedPath(locale, `/checkout/${slug}`), label: unavailable.restart }}
      />
    </div>
  );
}

/** سياسة لم يحسمها المالك: الشراء الإلكتروني غير متاح، وواتساب يعمل. */
function Unavailable({
  locale,
  slug,
  planName,
}: Omit<BodyProps, "options"> & { planName: string }) {
  const { checkout } = getDictionary(locale);
  return (
    <div className="container section">
      <UnavailableNotice
        title={checkout.unavailable.title}
        lead={checkout.unavailable.lead}
        primary={{
          href: planWhatsapp(locale, planName),
          label: checkout.unavailable.action,
          external: true,
        }}
        secondary={{
          href: localizedPath(locale, `/memberships/${slug}`),
          label: checkout.backToPlan,
        }}
      />
    </div>
  );
}

function CheckoutForms({ locale, slug, options, data }: BodyProps & { data: CheckoutQuote }) {
  const { quote } = data;
  const dictionary = getDictionary(locale);
  const coupon = couponMessage(quote, locale);
  const planName = quote.lines[0]?.name[locale] ?? slug;
  return (
    <div className={cx("container", styles.layout)}>
      <div className={styles.aside}>
        <QuoteSummary view={toQuoteView(quote, locale)} labels={dictionary.checkout.summary} />
      </div>
      <div className={styles.forms}>
        <OptionsForm
          action={localizedPath(locale, `/checkout/${slug}`)}
          addons={addonChoices(data.addons, options.addonSlugs, locale)}
          coupon={options.couponInput}
          couponMessage={coupon}
          labels={dictionary.checkout.options}
        />
        {coupon?.blocking === true ? (
          <p className={styles.blocked}>{dictionary.checkout.options.fixCoupon}</p>
        ) : (
          <DetailsForm
            locale={locale}
            initialState={initialCheckoutState(quote.total, locale)}
            slug={slug}
            addonSlugs={options.addonSlugs}
            coupon={data.couponCode}
            whatsappHref={planWhatsapp(locale, planName)}
            plansHref={localizedPath(locale, "/memberships")}
          />
        )}
      </div>
    </div>
  );
}

/**
 * صفحة الشراء (خلف العلم): الملخص المسعَّر على الخادم، ونموذج GET للإضافات والكوبون،
 * ثم نموذج البيانات. منتج غير قابل للبيع ⇒ 404، وسياسة غير محسومة ⇒ «غير متاح» بلا نموذج.
 */
export default async function CheckoutPage({ params, searchParams }: Props) {
  requireCheckout();
  const { locale, slug } = await params;
  const options = parseCheckoutOptions(await searchParams);
  if (!isLocale(locale) || !isSlug(slug) || options === undefined) {
    notFound();
  }
  const result = await getCheckoutQuote({ slug, ...options });
  if (!result.ok && result.error.code === "not_found") {
    notFound();
  }
  const { checkout } = getDictionary(locale);
  const back = (
    <Link href={localizedPath(locale, `/memberships/${slug}`)}>{checkout.backToPlan}</Link>
  );
  const body = !result.ok ? (
    <QuoteProblem locale={locale} slug={slug} error={result.error} />
  ) : result.value.quote.blockers.length > 0 ? (
    <Unavailable
      locale={locale}
      slug={slug}
      planName={result.value.quote.lines[0]?.name[locale] ?? slug}
    />
  ) : (
    <CheckoutForms locale={locale} slug={slug} options={options} data={result.value} />
  );
  return (
    <PageShell locale={locale} path={`/checkout/${slug}`}>
      <PageIntro title={checkout.intro.title} lead={checkout.intro.lead} before={back} />
      {body}
    </PageShell>
  );
}
