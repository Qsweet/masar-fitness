"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { AdminIcon } from "../admin-icon";
import drawerStyles from "./drawer.module.css";
import styles from "./shell.module.css";

interface MobileDrawerProps {
  readonly labels: { readonly open: string; readonly close: string; readonly title: string };
  /** العلامة في رأس الدرج، والتنقل تحته؛ مرسومان على الخادم. */
  readonly brand: ReactNode;
  readonly children: ReactNode;
}

/**
 * التنقل على الهاتف والجهاز اللوحي: درج جانبي في ‎<dialog>‎ أصلي يفتحه زر الشريط العلوي. المتصفح
 * يحبس التركيز داخله ويغلقه بـEsc ويضع الستار، ويعيد التركيز إلى الزر عند الإغلاق. يُغلق كذلك
 * بالضغط على الستار وبعد اختيار رابط.
 */
export function MobileDrawer({ labels, brand, children }: MobileDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);
  return (
    <>
      <button
        type="button"
        className={cx(styles.iconButton, styles.mobileOnly)}
        aria-label={labels.open}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <AdminIcon name="menu" />
      </button>
      <dialog
        ref={dialog}
        aria-label={labels.title}
        className={drawerStyles.drawer}
        data-drawer=""
        onClick={(event) => {
          // الضغط على الستار يقع على عنصر الحوار نفسه
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className={drawerStyles.drawerPanel} data-surface="dark">
          <div className={drawerStyles.drawerHead}>
            {brand}
            <button
              type="button"
              className={styles.iconButton}
              aria-label={labels.close}
              onClick={() => dialog.current?.close()}
            >
              <AdminIcon name="close" />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
