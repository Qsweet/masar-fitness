import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { MAIN_CONTENT_ID } from "@/components/page-shell";
import { StagingNote } from "@/components/staging-note";
import { getDictionary } from "@/i18n/dictionaries";
import { directionOf, isLocale, LOCALES } from "@/i18n/locales";
import { alexandria, changa } from "../fonts";
import "../globals.css";

// الأسعار تُقرأ من القاعدة عند كل طلب، وسياسة أمان المحتوى تولّد nonce لكل طلب (القرار 14).
export const dynamic = "force-dynamic";
export const dynamicParams = false;

export const viewport: Viewport = { themeColor: "#0c1014" };

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
      className={`${changa.variable} ${alexandria.variable}`}
    >
      <body>
        <a href={`#${MAIN_CONTENT_ID}`} className="skip-link">
          {dictionary.nav.skipToContent}
        </a>
        <StagingNote rawIndexable={process.env.SITE_INDEXABLE} text={dictionary.staging} />
        {children}
      </body>
    </html>
  );
}
