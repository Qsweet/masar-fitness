import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { MAIN_CONTENT_ID } from "@/components/page-shell";
import { isSiteIndexable } from "@/config/indexability";
import { getDictionary } from "@/i18n/dictionaries";
import { directionOf, isLocale, LOCALES } from "@/i18n/locales";
import "../globals.css";

// خط واحد للغتين (Alexandria، رخصة OFL) مستضاف ذاتيًا: لا طلب لطرف ثالث، ولا انزياح عند التحميل.
const arabicFont = localFont({
  src: "../../assets/fonts/alexandria-arabic-wght-normal.woff2",
  variable: "--font-arabic",
  weight: "100 900",
  display: "swap",
});
const latinFont = localFont({
  src: "../../assets/fonts/alexandria-latin-wght-normal.woff2",
  variable: "--font-latin",
  weight: "100 900",
  display: "swap",
});

// الأسعار تُقرأ من القاعدة عند كل طلب، وسياسة أمان المحتوى تولّد nonce لكل طلب (القرار 14).
export const dynamic = "force-dynamic";
export const dynamicParams = false;

export const viewport: Viewport = { themeColor: "#1d2125" };

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const { name } = getDictionary(locale).club;
  return { title: { default: name, template: `%s | ${name}` } };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${arabicFont.variable} ${latinFont.variable}`}
    >
      <body className="surface-asphalt min-h-dvh antialiased">
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-20 focus:rounded-control focus:bg-lane-500 focus:px-4 focus:py-3 focus:font-strong focus:text-asphalt-950"
        >
          {dictionary.nav.skipToContent}
        </a>
        {isSiteIndexable(process.env.SITE_INDEXABLE) ? null : (
          <p role="note" className="surface-chalk px-4 py-2 text-center text-small font-medium">
            {dictionary.staging}
          </p>
        )}
        {children}
      </body>
    </html>
  );
}
