"use client";

import { useEffect, useState } from "react";

/** رابط داخلي يُتبَع في الصفحة نفسها بنقرة عادية (لا نافذة جديدة ولا تنزيل ولا مفتاح تعديل). */
function internalHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) {
    return null;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.download) {
    return null;
  }
  const url = new URL(target.href, window.location.href);
  if (url.origin !== window.location.origin) {
    return null;
  }
  const samePage =
    url.pathname === window.location.pathname && url.search === window.location.search;
  return samePage ? null : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * حارس المغادرة (ADMIN_REDESIGN §6.2): ما دام في النموذج تعديل لم يُحفظ، تحذّر المتصفحُ عند إغلاق
 * الصفحة أو تحديثها، ويُعترض الرابط الداخلي بحوار داخلي يرجع الرابط المطلوب. يُرفع حين يصير نظيفًا.
 */
export function useLeaveGuard(active: boolean) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      const href = internalHref(event);
      if (href !== null) {
        event.preventDefault();
        event.stopPropagation();
        setPending(href);
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
  return { pending, clear: () => setPending(null) };
}

/** ⌘S / Ctrl+S يرسل النموذج بزره الأساسي ما دام فيه تعديل. */
export function useSaveShortcut(active: boolean, submit: () => void) {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyS") {
        event.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, submit]);
}
