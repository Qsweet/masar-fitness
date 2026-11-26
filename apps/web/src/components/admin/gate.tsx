import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import type { AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { logoutAction } from "@/server/admin/actions/session";
import { ADMIN_MAIN_ID } from "./admin-shell";
import { adminButton } from "./fields";
import styles from "./gate.module.css";

interface GateProps {
  readonly dictionary: AdminDictionary;
  readonly title: string;
  readonly lead: string;
  readonly wide?: boolean;
  /** صفحات ما بعد كلمة المرور تعرض «خروج»؛ صفحة الدخول لا جلسة فيها. */
  readonly signedIn?: boolean;
  readonly children: ReactNode;
}

/** إطار صفحات ما قبل اللوحة: الشعار، وبطاقة بعنوان وسطر، وخروج لمن دخل ولم يكمل خطوته. */
export function Gate({ dictionary, title, lead, wide, signedIn, children }: GateProps) {
  return (
    <div className={styles.gate}>
      <Logo variant="lockup" height="3rem" alt={dictionary.brand.logoAlt} preload />
      <main
        id={ADMIN_MAIN_ID}
        tabIndex={-1}
        className={cx(styles.card, wide === true && styles.wide)}
      >
        <div className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
          <span className={styles.track} aria-hidden="true" />
          <p className={styles.lead}>{lead}</p>
        </div>
        {children}
      </main>
      {signedIn === true ? (
        <form action={logoutAction} className={styles.foot}>
          <button type="submit" className={adminButton("ghost")}>
            {dictionary.nav.logout}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export { styles as gateStyles };
