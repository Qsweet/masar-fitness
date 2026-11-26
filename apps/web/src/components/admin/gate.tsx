import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import type { AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { logoutAction } from "@/server/admin/actions/session";
import styles from "./gate.module.css";
import { ADMIN_MAIN_ID } from "./main-id";
import { SubmitButton } from "./ui/submit-button";

interface GateProps {
  readonly dictionary: AdminDictionary;
  readonly title: string;
  readonly lead: string;
  readonly wide?: boolean;
  /** صفحات ما بعد كلمة المرور تعرض «خروج»؛ صفحة الدخول لا جلسة فيها. */
  readonly signedIn?: boolean;
  readonly children: ReactNode;
}

/** إطار صفحات ما قبل اللوحة: بلاطة الشعار، وبطاقة بعنوان وسطر، وخروج لمن دخل ولم يكمل خطوته. */
export function Gate({ dictionary, title, lead, wide, signedIn, children }: GateProps) {
  return (
    <div className={styles.gate}>
      <div className={styles.brand} data-surface="dark">
        <Logo variant="lockup" height="2.25rem" alt={dictionary.brand.logoAlt} preload />
      </div>
      <main
        id={ADMIN_MAIN_ID}
        tabIndex={-1}
        className={cx(styles.card, wide === true && styles.wide)}
      >
        <div className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </div>
        {children}
      </main>
      {signedIn === true ? (
        <form action={logoutAction}>
          <SubmitButton variant="ghost" size="small">
            {dictionary.nav.logout}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export { styles as gateStyles };
