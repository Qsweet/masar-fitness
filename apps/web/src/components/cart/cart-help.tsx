import { Icon } from "@/components/ui/icon";
import { whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./cart.module.css";

/** سطر مساعدة واتساب برسالة جاهزة بلا أي بيانات للعميل (رابط wa.me عادي، بلا سكربت طرف ثالث). */
export function CartHelp({ labels }: { readonly labels: Dictionary["cart"] }) {
  return (
    <a href={whatsappUrl(labels.helpMessage)} rel="noopener noreferrer" className={styles.help}>
      <Icon name="chat" />
      {labels.help}
    </a>
  );
}
