import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import styles from "./chat-button.module.css";

/**
 * زر محادثة عائم بالتدرّج في زاوية النهاية: يفتح واتساب النادي برسالة جاهزة.
 * على الهاتف يُخفى حين في الصفحة شريط ثابت فيه زر واتساب (لا يغطي نص الواجهة ولا البطاقات)،
 * وعلى اللوح يعلو شريط الشراء.
 */
export function ChatButton({
  label,
  href,
  phoneBar,
}: {
  readonly label: string;
  readonly href: string;
  /** شريط الهاتف في الصفحة: شريط الشراء، أو شريط الاختصارات، أو لا شريط */
  readonly phoneBar: "plans" | "quick" | "none";
}) {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cx(styles.chat, phoneBar !== "none" && styles.besideBar, styles[phoneBar])}
    >
      <Icon name="chat" />
    </a>
  );
}
