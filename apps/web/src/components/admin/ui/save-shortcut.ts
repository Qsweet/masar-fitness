"use client";

import { useEffect, type RefObject } from "react";

/** ⌘S أو Ctrl+S وحدهما: لا Shift ولا Alt، ولا أثناء تركيب الحروف (لوحة إدخال). */
export function isSaveShortcut(event: KeyboardEvent): boolean {
  if (event.isComposing || event.shiftKey || event.altKey) {
    return false;
  }
  return (event.metaKey || event.ctrlKey) && event.code === "KeyS";
}

/** النموذج الذي فيه التركيز الآن، أو null حين يكون التركيز خارج أي نموذج. */
export function focusedForm(active: Element | null): HTMLFormElement | null {
  return active?.closest("form") ?? null;
}

/** زر الإرسال الأساسي في الشريط، أو null وهو معطَّل أو ينتظر رد الخادم (لا إرسال مزدوج). */
export function readySubmit(bar: HTMLElement): HTMLButtonElement | null {
  const button = bar.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button === null || button.disabled || button.dataset.pending === "true") {
    return null;
  }
  return button;
}

/**
 * ⌘S يرسل النموذج الذي فيه التركيز وحده، بزره الأساسي (فتصل قيمة `intent`)، ما دام فيه تعديل. في صفحة
 * بنموذجين (المنتج) لا يُرسل الآخر، وخارج أي نموذج لا يُرسل شيء.
 */
export function useSaveShortcut(bar: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      const own = bar.current?.closest("form") ?? null;
      if (!isSaveShortcut(event) || own === null || focusedForm(document.activeElement) !== own) {
        return;
      }
      event.preventDefault();
      const button = bar.current === null ? null : readySubmit(bar.current);
      if (button !== null) {
        own.requestSubmit(button);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [bar, active]);
}
