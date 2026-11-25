import type { ReactNode } from "react";
import { getDictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { hasVisibleBlog } from "@/server/blog";
import { isCheckoutEnabled } from "@/server/checkout/flag";
import { whatsappUrl } from "@/config/club";
import { ROUTES } from "@/config/routes";
import { ChatButton } from "./chat-button";
import { MAIN_CONTENT_ID } from "./main-content-id";
import { MobileBar, type MobileBarAction } from "./mobile-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import styles from "./page-shell.module.css";

interface PageShellProps {
  readonly locale: Locale;
  /** مسار الصفحة بلا بادئة لغة (مثل ‎/memberships‎). */
  readonly path: string;
  /** الصفحة فيها قسم اشتراكات (#plans): زر الترويسة ينقل إليه بدل صفحة الاشتراكات. */
  readonly hasPlans?: boolean;
  /**
   * فعل شريط الهاتف في صفحة بلا قسم اشتراكات (الافتراضي: «اختر اشتراكك» إلى صفحة الاشتراكات).
   * `null` بلا شريط (صفحات الشراء: نموذجها هو الفعل). صفحة فيها قسم اشتراكات لها شريط الشراء الخاص بها.
   */
  readonly mobileAction?: MobileBarAction | null;
  readonly children: ReactNode;
}

export { MAIN_CONTENT_ID };

/** إطار كل صفحة: الترويسة والمحتوى والتذييل. الصفحة تمرر مسارها ليعمل تبديل اللغة بلا JavaScript. */
export function PageShell({ locale, path, hasPlans = false, children, ...props }: PageShellProps) {
  const dictionary = getDictionary(locale);
  const chat = { href: whatsappUrl(dictionary.location.whatsappMessage), label: dictionary.chat };
  const membershipsAction = {
    href: localizedPath(locale, ROUTES.memberships),
    label: dictionary.hero.action,
    external: false,
  };
  const mobileAction = hasPlans ? null : (props.mobileAction ?? membershipsAction);
  const phoneBar = hasPlans ? "plans" : mobileAction === null ? "none" : "quick";
  const joinHref = hasPlans ? "#plans" : localizedPath(locale, "/memberships");
  // رابط المدونة لا يظهر ما دامت بلا مقال ظاهر بلغة الزائر (لا صفحة فارغة ولا رابط إلى 404)
  const showBlog = hasVisibleBlog(locale);
  return (
    <>
      <SiteHeader
        locale={locale}
        path={path}
        joinHref={joinHref}
        showBlog={showBlog}
        dictionary={dictionary}
      />
      <main id={MAIN_CONTENT_ID}>{children}</main>
      <SiteFooter
        locale={locale}
        showBlog={showBlog}
        checkoutEnabled={isCheckoutEnabled()}
        dictionary={dictionary}
      />
      <ChatButton label={chat.label} href={chat.href} phoneBar={phoneBar} />
      {mobileAction === null ? null : (
        <MobileBar label={dictionary.quickBar} action={mobileAction} chat={chat} />
      )}
      {phoneBar === "none" ? null : <div className={styles[phoneBar]} aria-hidden="true" />}
    </>
  );
}
