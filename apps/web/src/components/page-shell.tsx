import type { ReactNode } from "react";
import { getDictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { hasVisibleBlog } from "@/server/blog";
import { cartCount } from "@/server/cart/codec";
import { readCart } from "@/server/cart/cookie";
import { isCheckoutEnabled } from "@/server/checkout/flag";
import type { CartLinkView } from "./cart/cart-link";
import { whatsappUrl } from "@/config/club";
import { CART_PATH, ROUTES } from "@/config/routes";
import { ChatButton } from "./chat-button";
import { MAIN_CONTENT_ID } from "./main-content-id";
import { MobileBar, type MobileBarAction } from "./mobile-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TabBar } from "./tab-bar";
import { cx } from "@/lib/cx";
import styles from "./page-shell.module.css";

interface PageShellProps {
  readonly locale: Locale;
  /** مسار الصفحة بلا بادئة لغة (مثل ‎/memberships‎). */
  readonly path: string;
  /** الصفحة فيها قسم اشتراكات (#plans): زر الترويسة ينقل إليه بدل صفحة الاشتراكات. */
  readonly hasPlans?: boolean;
  /**
   * فعل شريط الشراء فوق شريط التبويب على الهاتف في صفحة بلا قسم اشتراكات (صفحة الاشتراك الواحد).
   * `null` بلا أي شريط سفلي (صفحات الشراء: نموذجها هو الفعل). صفحة فيها قسم اشتراكات لها شريطها الخاص.
   */
  readonly mobileAction?: MobileBarAction | null;
  readonly children: ReactNode;
}

export { MAIN_CONTENT_ID };

type PhoneBar = "plans" | "quick" | "none";

/** الشريط الثابت فوق شريط التبويب: شراء قسم الاشتراكات، أو فعل الصفحة، أو لا شيء. */
function phoneBarOf(hasPlans: boolean, action: MobileBarAction | null | undefined): PhoneBar {
  if (hasPlans) {
    return "plans";
  }
  return action === null || action === undefined ? "none" : "quick";
}

/** رابط السلة في الترويسة والشراء مفتوح: العدد من الكوكي بعد فكّه فقط، بلا قراءة قاعدة. */
async function cartLink(locale: Locale): Promise<CartLinkView | null> {
  if (!isCheckoutEnabled()) {
    return null;
  }
  const count = cartCount(await readCart());
  const { link } = getDictionary(locale).cart;
  return {
    href: localizedPath(locale, CART_PATH),
    count,
    label: count > 0 ? link.one : link.empty,
  };
}

/**
 * إطار كل صفحة: الترويسة والمحتوى والتذييل، وعلى الهاتف شريط التبويب السفلي (إلا في صفحات الشراء).
 * الصفحة تمرر مسارها ليعمل تبديل اللغة والتبويب النشط بلا JavaScript.
 */
export async function PageShell({
  locale,
  path,
  hasPlans = false,
  children,
  mobileAction,
}: PageShellProps) {
  const dictionary = getDictionary(locale);
  const chat = { href: whatsappUrl(dictionary.location.whatsappMessage), label: dictionary.chat };
  const showTabs = mobileAction !== null;
  const phoneBar = phoneBarOf(hasPlans, mobileAction);
  const joinHref = hasPlans ? "#plans" : localizedPath(locale, ROUTES.memberships);
  // رابط المدونة لا يظهر ما دامت بلا مقال ظاهر بلغة الزائر (لا صفحة فارغة ولا رابط إلى 404)
  const showBlog = hasVisibleBlog(locale);
  const cart = await cartLink(locale);
  return (
    <>
      <SiteHeader
        locale={locale}
        path={path}
        joinHref={joinHref}
        showBlog={showBlog}
        cart={cart}
        dictionary={dictionary}
      />
      <main id={MAIN_CONTENT_ID}>{children}</main>
      <SiteFooter
        locale={locale}
        showBlog={showBlog}
        checkoutEnabled={isCheckoutEnabled()}
        dictionary={dictionary}
      />
      <ChatButton label={chat.label} href={chat.href} phoneBar={phoneBar} tabs={showTabs} />
      {phoneBar === "quick" && mobileAction !== undefined && mobileAction !== null ? (
        <MobileBar label={dictionary.quickBar} action={mobileAction} />
      ) : null}
      {showTabs ? (
        <TabBar
          locale={locale}
          path={path}
          showBlog={showBlog}
          whatsappHref={chat.href}
          dictionary={dictionary}
        />
      ) : null}
      <div
        className={cx(styles.spacer, showTabs && styles.tabs, styles[phoneBar])}
        aria-hidden="true"
      />
    </>
  );
}
