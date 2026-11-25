import Link from "next/link";
import { INTRO_ID } from "@/components/page-intro";
import { Icon } from "@/components/ui/icon";
import { StickyReveal } from "@/components/ui/sticky-reveal";
import styles from "./mobile-bar.module.css";

/** الفعل الرئيسي في الشريط: صفحة داخلية أو رابط خارجي (واتساب الاشتراك). */
export interface MobileBarAction {
  readonly href: string;
  readonly label: string;
  readonly external: boolean;
}

interface MobileBarProps {
  readonly label: string;
  readonly action: MobileBarAction;
  readonly chat: { readonly href: string; readonly label: string };
}

/**
 * شريط الهاتف الثابت في الصفحات بلا قسم اشتراكات (المدونة، الحاسبة، صفحة الاشتراك، 404): الفعل الرئيسي
 * في منطقة الإبهام، وزر واتساب مكان زر المحادثة العائم الذي يُخفى على الهاتف. يظهر بعد أن يتجاوز الزائر
 * رأس الصفحة (#top)، فلا يكرر زر بطاقة السعر ولا يحجب ما تحتها. بلا JavaScript يبقى مخفيًا كشريط الشراء.
 */
export function MobileBar({ label, action, chat }: MobileBarProps) {
  return (
    <StickyReveal afterId={INTRO_ID} label={label} className={styles.bar}>
      {action.external ? (
        <a href={action.href} rel="noopener noreferrer" className={styles.action}>
          {action.label}
        </a>
      ) : (
        <Link href={action.href} className={styles.action}>
          {action.label}
        </Link>
      )}
      <a
        href={chat.href}
        rel="noopener noreferrer"
        aria-label={chat.label}
        title={chat.label}
        className={styles.chat}
      >
        <Icon name="chat" />
      </a>
    </StickyReveal>
  );
}
