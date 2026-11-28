"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

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

/**
 * هل في النموذج المحيط بالعنصر تعديل لم يُحفظ؟ يُعاد الحساب مع كل إدخال وتغيير وإعادة ضبط، وبعد كل رسم
 * (رد الخادم يعيد رسم الحقول بقيمها الجديدة فيصير النموذج نظيفًا).
 */
export function useDirtyForm(anchor: RefObject<HTMLElement | null>) {
  const [dirty, setDirty] = useState(false);
  const formOf = useCallback(() => anchor.current?.closest("form") ?? null, [anchor]);
  const update = useCallback(() => {
    const form = formOf();
    setDirty(form === null ? false : isFormDirty(form));
  }, [formOf]);
  useEffect(() => {
    const form = formOf();
    if (form === null) {
      return undefined;
    }
    const later = () => requestAnimationFrame(update);
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("reset", later);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      form.removeEventListener("reset", later);
    };
  }, [formOf, update]);
  useEffect(update);
  return { dirty, formOf };
}
