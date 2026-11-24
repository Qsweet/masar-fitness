import type { ReactNode } from "react";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface PageShellProps {
  readonly locale: Locale;
  /** مسار الصفحة بلا بادئة لغة (مثل ‎/memberships‎). */
  readonly path: string;
  /** الصفحة تعرض شريط شراء ثابتًا على الجوال: يُترك تحت التذييل فراغ بارتفاعه حتى لا يغطيه. */
  readonly stickyBar?: boolean;
  readonly children: ReactNode;
}

export const MAIN_CONTENT_ID = "main";

/** إطار كل صفحة: الترويسة والمحتوى والتذييل. الصفحة تمرر مسارها ليعمل تبديل اللغة بلا JavaScript. */
export function PageShell({ locale, path, stickyBar = false, children }: PageShellProps) {
  const dictionary = getDictionary(locale);
  return (
    <>
      <SiteHeader locale={locale} path={path} dictionary={dictionary} />
      <main id={MAIN_CONTENT_ID}>{children}</main>
      <SiteFooter locale={locale} dictionary={dictionary} />
      {stickyBar ? (
        <div className="surface-deep surface-deep-low h-20 md:hidden" aria-hidden="true" />
      ) : null}
    </>
  );
}
