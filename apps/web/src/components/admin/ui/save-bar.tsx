"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useKitText } from "./form-kit";
import { buttonClass } from "./kit";
import styles from "./save-bar.module.css";
import { useDirtyForm } from "./use-dirty-form";
import { useLeaveGuard, useSaveShortcut } from "./use-leave-guard";

interface LeaveDialogProps {
  readonly href: string | null;
  readonly onStay: () => void;
}

/** حوار المغادرة: `<dialog>` أصلي، والتركيز الأول على «ابقَ هنا» (الفعل الآمن). */
function LeaveDialog({ href, onStay }: LeaveDialogProps) {
  const text = useKitText();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (href !== null && dialog.current?.open !== true) {
      dialog.current?.showModal();
    }
  }, [href]);
  if (text === null || href === null) {
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
        {text.leave.title}
      </h2>
      <p id="leave-lead" className={styles.dialogLead}>
        {text.leave.lead}
      </p>
      <div className={styles.dialogActions}>
        <button
          type="button"
          className={buttonClass({ variant: "danger" })}
          onClick={() => router.push(href)}
        >
          {text.leave.leave}
        </button>
        {/* autoFocus: الحوار يفتح على الفعل الآمن */}
        <button
          type="button"
          className={buttonClass()}
          onClick={() => dialog.current?.close()}
          autoFocus
        >
          {text.leave.stay}
        </button>
      </div>
    </dialog>
  );
}

/**
 * تذييل النموذج v2 (ADMIN_REDESIGN §6.2): أزرار الإرسال الحقيقية في مكانها (تعمل بلا JavaScript)، ومع
 * JavaScript يلتصق بأسفل الشاشة حين يتغير حقل، بنص «تعديلات غير محفوظة» و«تجاهل» واختصار ⌘S، ويعترض
 * المغادرة حتى يُحفظ أو يُتجاهل. خارج الهيكل (صفحات البوابة) تذييل عادي.
 */
export function SaveBar({ children }: { readonly children: ReactNode }) {
  const text = useKitText();
  const bar = useRef<HTMLDivElement>(null);
  const { dirty, formOf } = useDirtyForm(bar);
  /* نصوص الحالة حين يكون في النموذج تعديل داخل الهيكل؛ وإلا null والتذييل عادي */
  const shown = dirty ? text : null;
  const guarded = shown !== null;
  const leave = useLeaveGuard(guarded);
  const submit = useCallback(() => {
    const button = bar.current?.querySelector<HTMLButtonElement>("button[type=submit]");
    formOf()?.requestSubmit(button ?? null);
  }, [formOf]);
  useSaveShortcut(guarded, submit);
  return (
    <div ref={bar} className={cx(styles.bar, guarded && styles.dirty)} data-dirty={guarded}>
      <p className={styles.status} aria-live="polite">
        {shown === null ? null : (
          <>
            <span className={styles.dot} aria-hidden="true" />
            {shown.saveBar.dirty}
            <span className={styles.hint}>{shown.saveBar.shortcut}</span>
          </>
        )}
      </p>
      <div className={styles.actions}>
        {shown === null ? null : (
          <button
            type="button"
            className={buttonClass({ variant: "ghost" })}
            onClick={() => formOf()?.reset()}
          >
            {shown.saveBar.discard}
          </button>
        )}
        {children}
      </div>
      <LeaveDialog href={leave.pending} onStay={leave.clear} />
    </div>
  );
}
