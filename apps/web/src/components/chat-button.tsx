import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import styles from "./chat-button.module.css";

/**
 * زر محادثة عائم أصفر في زاوية النهاية: يفتح واتساب النادي برسالة جاهزة.
 * على الهاتف يُخفى حين في الصفحة شريط تبويب (فيه واتساب)، وعلى اللوح يعلو شريط الشراء.
 */
export function ChatButton({
  label,
  href,
  phoneBar,
  tabs,
}: {
  readonly label: string;
  readonly href: string;
  /** شريط الهاتف في الصفحة: شريط الشراء، أو شريط الاختصارات، أو لا شريط */
  readonly phoneBar: "plans" | "quick" | "none";
  /** على الهاتف شريط تبويب فيه واتساب: الزر العائم يُخفى هناك */
  readonly tabs: boolean;
}) {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cx(styles.chat, tabs && styles.besideBar, styles[phoneBar])}
    >
      <Icon name="chat" />
    </a>
  );
}
