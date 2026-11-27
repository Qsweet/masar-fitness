"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CONSENT_CHANGED, readConsent } from "./consent-cookie";
import { loadSinks } from "./load-sinks";
import { addSink, hasSinks, newEventId, track } from "./track";
import type { ClientProvider } from "./types";
import { updateGoogleConsent } from "./vendors/google";

interface TagLoaderProps {
  readonly providers: readonly ClientProvider[];
  readonly nonce: string | undefined;
}

/**
 * محمّل الوسوم (ADMIN_A5_TRACKING §3.2): لا شيء قبل الموافقة. أول موافقة تحمّل وسوم فئاتها وترسل ما
 * وقع في الصفحة الحالية؛ أي تغيير بعد التحميل (سحبًا أو توسعة) يحدّث Consent Mode ثم يعيد تحميل الصفحة،
 * فلا يبقى وسم محمَّل لفئة سُحبت ولا وسم بنصف إعداد. `page_view` مع كل تنقل.
 */
export function TagLoader({ providers, nonce }: TagLoaderProps) {
  const pathname = usePathname();
  const consentRef = useRef(readConsentSafe());

  useEffect(() => {
    const load = () => {
      const consent = consentRef.current;
      if (consent !== null && !hasSinks()) {
        loadSinks(providers, consent, nonce).forEach(addSink);
      }
    };
    load();
    const onChange = () => {
      const after = readConsent();
      consentRef.current = after;
      if (after === null) {
        return;
      }
      if (hasSinks()) {
        // السحب يصل Google قبل إعادة التحميل؛ والصفحة الجديدة تحمّل ما بقي مسموحًا وحده
        updateGoogleConsent(after);
        window.location.reload();
        return;
      }
      load();
    };
    window.addEventListener(CONSENT_CHANGED, onChange);
    return () => {
      window.removeEventListener(CONSENT_CHANGED, onChange);
    };
  }, [providers, nonce]);

  useEffect(() => {
    track("page_view", { eventId: newEventId() });
  }, [pathname]);

  return null;
}

/** على الخادم لا `document`: الموافقة تُقرأ في المتصفح وحده. */
function readConsentSafe() {
  return typeof document === "undefined" ? null : readConsent();
}
