import type { ReactNode } from "react";
import { getDictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import styles from "./page-shell.module.css";

interface PageShellProps {
  readonly locale: Locale;
  /** مسار الصفحة بلا بادئة لغة (مثل ‎/memberships‎). */
  readonly path: string;
  /** الصفحة فيها قسم اشتراكات (#plans): زر الترويسة ينقل إليه بدل صفحة الاشتراكات. */
  readonly hasPlans?: boolean;
  readonly children: ReactNode;
}

export const MAIN_CONTENT_ID = "main";

/** إطار كل صفحة: الترويسة والمحتوى والتذييل. الصفحة تمرر مسارها ليعمل تبديل اللغة بلا JavaScript. */
export function PageShell({ locale, path, hasPlans = false, children }: PageShellProps) {
  const dictionary = getDictionary(locale);
  const joinHref = hasPlans ? "#plans" : localizedPath(locale, "/memberships");
  return (
    <>
      <SiteHeader locale={locale} path={path} joinHref={joinHref} dictionary={dictionary} />
      <main id={MAIN_CONTENT_ID}>{children}</main>
      <SiteFooter locale={locale} dictionary={dictionary} />
      {hasPlans ? <div className={styles.barSpace} aria-hidden="true" /> : null}
    </>
  );
}
