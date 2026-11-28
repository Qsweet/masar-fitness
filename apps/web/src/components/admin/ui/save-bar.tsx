"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useKitText } from "./form-kit";
import { buttonClass } from "./kit";
import { LeaveDialog } from "./leave-dialog";
import styles from "./save-bar.module.css";
import { useSaveShortcut } from "./save-shortcut";
import { useDirtyForm } from "./use-dirty-form";
import { useLeaveGuard } from "./use-leave-guard";

interface SaveBarProps {
  /**
   * غير محفوظ وإن طابقت الحقول قيمها الأولى: بعد رفض الخادم أو في خطوة «راجع» تُرسم الحقول بما أُرسل،
   * فلا تكفي المقارنة بالقيم الأولى لمعرفة أن شيئًا لم يُحفظ.
   */
  readonly unsaved?: boolean;
  readonly children: ReactNode;
}

/**
 * تذييل النموذج v2 (ADMIN_REDESIGN §6.2): أزرار الإرسال الحقيقية في مكانها (تعمل بلا JavaScript)، ومع
 * JavaScript يلتصق بأسفل الشاشة حين يتغير حقل أو لم يُحفظ المرسَل، بنص «تعديلات غير محفوظة» و«تجاهل»
 * (لما تغيّر في الحقول) واختصار ⌘S، ويعترض المغادرة حتى يُحفظ أو يُتجاهل. خارج الهيكل تذييل عادي.
 */
export function SaveBar({ unsaved, children }: SaveBarProps) {
  const text = useKitText();
  const router = useRouter();
  const bar = useRef<HTMLDivElement>(null);
  const { dirty, formOf } = useDirtyForm(bar);
  /* نصوص الحالة حين يكون في النموذج ما لم يُحفظ داخل الهيكل؛ وإلا null والتذييل عادي */
  const shown = dirty || unsaved === true ? text : null;
  const guarded = shown !== null;
  const guard = useLeaveGuard(guarded);
  useSaveShortcut(bar, guarded);
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
        {shown === null || !dirty ? null : (
          <button
            type="button"
            className={buttonClass({ variant: "ghost" })}
            onClick={() => {
              formOf()?.reset();
            }}
          >
            {shown.saveBar.discard}
          </button>
        )}
        {children}
      </div>
      {text === null ? null : (
        <LeaveDialog
          href={guard.pending}
          text={text.leave}
          onStay={guard.clear}
          onLeave={(href) => {
            guard.leave();
            router.push(href);
          }}
        />
      )}
    </div>
  );
}
