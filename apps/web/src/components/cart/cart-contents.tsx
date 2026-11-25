import Link from "next/link";
import { QuoteSummary } from "@/components/checkout/quote-summary";
import type { QuoteView } from "@/components/checkout/quote-view";
import type { PlanView } from "@/components/plans/plan-view";
import { buttonClass } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { removeFromCart } from "@/server/cart/actions";
import { CartHelp } from "./cart-help";
import styles from "./cart.module.css";

interface CartContentsProps {
  readonly plan: PlanView;
  readonly quote: QuoteView;
  readonly locale: Locale;
  /** خطوة البيانات للاشتراك الذي في السلة */
  readonly checkoutHref: string;
  readonly dictionary: Dictionary;
}

/** سطر الاشتراك: الاسم التسويقي والاسم والمدة والتجميد، وزر حذف حقيقي (نموذج POST). */
function CartLine({ plan, locale, dictionary }: Omit<CartContentsProps, "quote" | "checkoutHref">) {
  const { cart } = dictionary;
  return (
    <article aria-labelledby="cart-line-name" className={styles.line}>
      {plan.tier === undefined ? null : <p className={styles.tier}>{plan.tier}</p>}
      <h2 id="cart-line-name" className={styles.lineName}>
        <Link href={plan.href}>{plan.name}</Link>
      </h2>
      <p className={styles.muted}>{plan.durationText}</p>
      <p className={styles.muted}>{plan.freezeText}</p>
      <p className={styles.linePrice}>
        <Price parts={plan.price} />
      </p>
      <form action={removeFromCart} className={styles.remove}>
        <input type="hidden" name="slug" value={plan.slug} />
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className={styles.textButton}>
          {cart.remove}
        </button>
      </form>
      <p className={styles.hint}>{cart.oneMembership}</p>
    </article>
  );
}

/** شريط الإجمالي والمتابعة الثابت على الهاتف (صفحة السلة بلا شريط تبويب، فهو أسفل الشاشة). */
function CartBar({ quote, checkoutHref, dictionary }: Omit<CartContentsProps, "plan" | "locale">) {
  const { cart } = dictionary;
  return (
    <aside aria-label={cart.barLabel} className={styles.bar}>
      <p className={styles.barTotal}>
        <span className={styles.barLabel}>{cart.total}</span>
        <Price parts={quote.totals.total} />
      </p>
      <Link href={checkoutHref} className={styles.barAction}>
        {cart.continue}
      </Link>
    </aside>
  );
}

/**
 * السلة بسطرها: الاشتراك وزر الحذف، ثم الملخص المسعَّر على الخادم بمحرك الطلب نفسه وزر «أكمل الطلب»
 * (الفعل الأساسي الوحيد في الصفحة) ومساعدة واتساب. على الهاتف الإجمالي والزر في شريط ثابت.
 */
export function CartContents(props: CartContentsProps) {
  const { quote, checkoutHref, dictionary } = props;
  const { cart } = dictionary;
  return (
    <div className={cx("container", styles.layout)}>
      <CartLine {...props} />
      <div className={styles.aside}>
        <QuoteSummary view={quote} labels={dictionary.checkout.summary} />
        <Link href={checkoutHref} className={buttonClass("primary", true)}>
          {cart.continue}
          <Icon name="arrow" />
        </Link>
        <p className={styles.hint}>{cart.nextStep}</p>
        <CartHelp labels={cart} />
      </div>
      <CartBar {...props} />
    </div>
  );
}
