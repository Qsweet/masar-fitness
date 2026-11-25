import { Icon } from "@/components/ui/icon";
import { whatsappUrl } from "@/config/club";
import { cx } from "@/lib/cx";
import styles from "./chat-button.module.css";

/** زر محادثة عائم بالتدرّج في زاوية النهاية: يفتح واتساب النادي برسالة جاهزة. */
export function ChatButton({
  label,
  message,
  raised,
}: {
  readonly label: string;
  readonly message: string;
  /** الصفحة فيها شريط شراء ثابت على الجوال: الزر فوقه لا فوق محتواه */
  readonly raised: boolean;
}) {
  return (
    <a
      href={whatsappUrl(message)}
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cx(styles.chat, raised && styles.raised)}
    >
      <Icon name="chat" />
    </a>
  );
}
