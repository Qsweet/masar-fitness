import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import styles from "./cart-link.module.css";

export interface CartLinkView {
  readonly href: string;
  readonly count: number;
  /** الاسم المقروء بالعدد («السلة، عنصر واحد»)؛ الرقم المرئي مخفي عن قارئ الشاشة */
  readonly label: string;
}

/** رابط السلة في الترويسة بأيقونة وشارة عدد صفراء حين لا تكون فارغة. يظهر والشراء مفتوح فقط. */
export function CartLink({ href, count, label }: CartLinkView) {
  return (
    <Link href={href} className={styles.link}>
      <Icon name="bag" />
      <span className="sr-only">{label}</span>
      {count > 0 ? (
        <span className={styles.badge} aria-hidden="true" data-testid="cart-count">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
