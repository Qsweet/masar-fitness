import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { MAIN_CONTENT_ID } from "@/components/page-shell";
import { ScrollReset } from "@/components/scroll-reset";
import { StagingNote } from "@/components/staging-note";
import { getDictionary } from "@/i18n/dictionaries";
import { directionOf, isLocale, LOCALES } from "@/i18n/locales";
import { alexandria } from "../fonts";
import "../globals.css";
import "../patterns.css";

// الأسعار تُقرأ من القاعدة عند كل طلب، وسياسة أمان المحتوى تولّد nonce لكل طلب (القرار 14).
export const dynamic = "force-dynamic";
export const dynamicParams = false;

// لون شريط المتصفح على الجوال: أسود الترويسة (--ink في globals.css)
export const viewport: Viewport = { themeColor: "#0a0a0a" };

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
    // data-scroll-behavior: الانتقال بين الصفحات فوري، والتمرير الناعم للروابط داخل الصفحة فقط
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={alexandria.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <a href={`#${MAIN_CONTENT_ID}`} className="skip-link">
          {dictionary.nav.skipToContent}
        </a>
        <StagingNote rawIndexable={process.env.SITE_INDEXABLE} text={dictionary.staging} />
        {children}
        <ScrollReset />
      </body>
    </html>
  );
}
