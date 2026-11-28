"use client";

import { useEffect, useState, type RefObject } from "react";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** حقل تغيّر عن قيمته الأولى كما رسمها الخادم (`defaultValue` وأخواتها)، فلا لقطة تُحفظ ولا تتقادم. */
function changed(control: Control): boolean {
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.options).some((option) => option.selected !== option.defaultSelected);
  }
  if (control instanceof HTMLInputElement) {
    if (control.type === "hidden" || control.type === "submit" || control.type === "button") {
      return false;
    }
    if (control.type === "checkbox" || control.type === "radio") {
      return control.checked !== control.defaultChecked;
    }
    if (control.type === "file") {
      return control.files !== null && control.files.length > 0;
    }
  }
  return control.value !== control.defaultValue;
}

export function isFormDirty(form: HTMLFormElement): boolean {
  return Array.from(form.elements).some(
    (element) =>
      (element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement) &&
      !element.disabled &&
      changed(element),
  );
}

function formOf(anchor: RefObject<HTMLElement | null>): HTMLFormElement | null {
  return anchor.current?.closest("form") ?? null;
}

/**
 * هل في النموذج المحيط بالعنصر تعديل لم يُحفظ؟ يُعاد الحساب مع كل إدخال وتغيير وإعادة ضبط، ومع كل تغيّر
 * في عناصر النموذج (رد الخادم يعيد رسم الحقول بقيمها الجديدة فيصير النموذج نظيفًا).
 */
export function useDirtyForm(anchor: RefObject<HTMLElement | null>) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const form = formOf(anchor);
    if (form === null) {
      return undefined;
    }
    const update = () => {
      setDirty(isFormDirty(form));
    };
    const later = () => requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(form, { childList: true, subtree: true });
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("reset", later);
    return () => {
      observer.disconnect();
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      form.removeEventListener("reset", later);
    };
  }, [anchor]);
  return { dirty, formOf: () => formOf(anchor) };
}
