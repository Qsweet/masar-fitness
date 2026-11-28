"use client";

import { useEffect, useRef, useState } from "react";
import { holdLeaveGuard, LEAVE_REQUEST_EVENT } from "./leave-request";

/** نقرة عادية: الزر الأيسر بلا مفتاح تعديل، ولم يعالجها غيرنا. */
function plainClick(event: MouseEvent): boolean {
  const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  return !event.defaultPrevented && event.button === 0 && !modified;
}

/** رابط يفتح في الصفحة نفسها (لا نافذة جديدة ولا تنزيل). */
function sameTabLink(event: MouseEvent): HTMLAnchorElement | null {
  const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (
    !(target instanceof HTMLAnchorElement) ||
    target.target === "_blank" ||
    target.hasAttribute("download")
  ) {
    return null;
  }
  return target;
}

/** رابط داخلي إلى صفحة أخرى يُتبَع بنقرة عادية؛ وإلا null. */
export function internalHref(event: MouseEvent): string | null {
  const link = plainClick(event) ? sameTabLink(event) : null;
  if (link === null) {
    return null;
  }
  const url = new URL(link.href, window.location.href);
  const here = window.location;
  const samePage = url.pathname === here.pathname && url.search === here.search;
  return url.origin !== here.origin || samePage ? null : `${url.pathname}${url.search}${url.hash}`;
}

/** الرابط المطلوب من طلب مغادرة (لوحة الأوامر)، أو null لحدث غريب. */
function requestedHref(event: Event): string | null {
  return event instanceof CustomEvent && typeof event.detail === "string" ? event.detail : null;
}

/**
 * حارس المغادرة (ADMIN_REDESIGN §6.2): ما دام في النموذج تعديل لم يُحفظ، يحذّر المتصفح عند إغلاق الصفحة
 * أو تحديثها، ويُعترض الرابط الداخلي وطلب المغادرة من لوحة الأوامر بحوار داخلي. حارس واحد يأخذ الطلب
 * (الأول يوقفه عن البقية). `leave` يرفع الحارس قبل التنقل فلا يسأل المتصفح ثانية.
 * لا يُعترض زر الرجوع في المتصفح (التاريخ بيد الموجّه، ولا اعتراض موثوقًا له في App Router)، ولا «خروج»
 * (زر نموذج يرسل، لا رابط): الأول يحذّر منه المتصفح إن أُعيد تحميل الصفحة، والثاني فعل صريح.
 */
export function useLeaveGuard(active: boolean) {
  const [pending, setPending] = useState<string | null>(null);
  const leaving = useRef(false);
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    leaving.current = false;
    const release = holdLeaveGuard();
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!leaving.current) {
        event.preventDefault();
      }
    };
    const onClick = (event: MouseEvent) => {
      const href = internalHref(event);
      if (href !== null) {
        event.preventDefault();
        event.stopPropagation();
        setPending(href);
      }
    };
    const onRequest = (event: Event) => {
      const href = requestedHref(event);
      if (href !== null) {
        event.stopImmediatePropagation();
        setPending(href);
      }
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener(LEAVE_REQUEST_EVENT, onRequest);
    document.addEventListener("click", onClick, true);
    return () => {
      release();
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener(LEAVE_REQUEST_EVENT, onRequest);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
  return {
    pending,
    clear: () => {
      setPending(null);
    },
    /** قبل التنقل المؤكَّد: لا تحذير ثانٍ من المتصفح. */
    leave: () => {
      leaving.current = true;
    },
  };
}
