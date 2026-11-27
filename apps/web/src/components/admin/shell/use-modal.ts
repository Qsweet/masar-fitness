"use client";

import { useEffect, useRef } from "react";

/**
 * الحوار يُرسم حين يُفتح فقط: يُعرض نافذةً عند التركيب، ويعيد التركيز عند الإزالة إلى ما كان عليه قبل
 * الفتح (زر البحث أو حيث ضُغط ⌘K).
 */
export function useModalOnMount() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, []);
  return dialog;
}
