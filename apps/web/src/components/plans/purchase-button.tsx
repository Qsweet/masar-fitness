import type { ReactNode } from "react";
import { addToCart } from "@/server/cart/actions";
import type { PurchaseLink } from "./plan-view";
import styles from "./purchase-button.module.css";

interface PurchaseButtonProps {
  readonly purchase: PurchaseLink;
  readonly className: string | undefined;
  readonly children: ReactNode;
}

/**
 * زر الشراء الواحد: والشراء الإلكتروني مفتوح نموذج POST حقيقي يضيف الاشتراك إلى السلة (يعمل بلا
 * JavaScript)، وإلا رابط واتساب. النموذج لا يغيّر التخطيط (display: contents).
 */
export function PurchaseButton({ purchase, className, children }: PurchaseButtonProps) {
  if (purchase.kind === "whatsapp") {
    return (
      <a href={purchase.href} rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <form action={addToCart} className={styles.form}>
      <input type="hidden" name="slug" value={purchase.slug} />
      <input type="hidden" name="locale" value={purchase.locale} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
