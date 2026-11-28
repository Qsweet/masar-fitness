"use client";

import { useEffect, useRef } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { buttonClass } from "./kit";
import styles from "./save-bar.module.css";

interface LeaveDialogProps {
  readonly href: string | null;
  readonly text: AdminDictionary["kit"]["leave"];
  readonly onStay: () => void;
  readonly onLeave: (href: string) => void;
}

/**
 * حوار المغادرة: `<dialog>` أصلي. التركيز بعد الفتح على «ابقَ هنا» صراحةً (الفعل الآمن)، لا على أول زر
 * (`showModal` يركّز أول عنصر قابل للتركيز، وهو «غادر بلا حفظ»). Esc والإغلاق يعنيان البقاء.
 */
export function LeaveDialog({ href, text, onStay, onLeave }: LeaveDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (href !== null && dialog.current?.open !== true) {
      dialog.current?.showModal();
      stay.current?.focus();
    }
  }, [href]);
  if (href === null) {
    return null;
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="leave-title"
      aria-describedby="leave-lead"
      onClose={onStay}
    >
      <h2 id="leave-title" className={styles.dialogTitle}>
        {text.title}
      </h2>
      <p id="leave-lead" className={styles.dialogLead}>
        {text.lead}
      </p>
      <div className={styles.dialogActions}>
        <button
          type="button"
          className={buttonClass({ variant: "danger" })}
          onClick={() => {
            onLeave(href);
          }}
        >
          {text.leave}
        </button>
        <button
          ref={stay}
          type="button"
          className={buttonClass()}
          onClick={() => {
            dialog.current?.close();
          }}
        >
          {text.stay}
        </button>
      </div>
    </dialog>
  );
}
