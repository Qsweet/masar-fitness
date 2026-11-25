import { ButtonLink } from "@/components/ui/button-link";
import styles from "./unavailable-notice.module.css";

interface NoticeAction {
  readonly href: string;
  readonly label: string;
  readonly external?: boolean;
}

interface UnavailableNoticeProps {
  readonly title: string;
  readonly lead: string;
  /** الفعل الأساسي (واتساب غالبًا). */
  readonly primary: NoticeAction;
  /** بديل ثانوي، مثل الرجوع إلى الاشتراك. */
  readonly secondary?: NoticeAction;
}

/**
 * الشراء الإلكتروني غير متاح لهذا الطلب (سياسة لم يحسمها المالك، أو سلة لا تُسعَّر): نقول ذلك
 * بصدق ونعطي قناة تعمل، بلا نموذج.
 */
export function UnavailableNotice({ title, lead, primary, secondary }: UnavailableNoticeProps) {
  return (
    <section role="status" aria-labelledby="unavailable-title" className={styles.notice}>
      <h2 id="unavailable-title" className={styles.title}>
        {title}
      </h2>
      <p className={styles.lead}>{lead}</p>
      <div className={styles.actions}>
        <ButtonLink href={primary.href} external={primary.external === true}>
          {primary.label}
        </ButtonLink>
        {secondary === undefined ? null : (
          <ButtonLink href={secondary.href} external={secondary.external === true} variant="line">
            {secondary.label}
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
