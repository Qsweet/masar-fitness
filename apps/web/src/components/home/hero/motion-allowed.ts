import { useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** «توفير البيانات» من المتصفح (Chromium)؛ غير معرّف في أنواع DOM القياسية فيُقرأ بحذر. */
function prefersSaveData(): boolean {
  const connection: unknown = Reflect.get(navigator, "connection");
  return (
    typeof connection === "object" &&
    connection !== null &&
    Reflect.get(connection, "saveData") === true
  );
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function snapshot(): boolean {
  return !window.matchMedia(REDUCED_MOTION).matches && !prefersSaveData();
}

/** على الخادم وقبل التحميل: لا فيديو (الصورة الثابتة وحدها). */
function serverSnapshot(): boolean {
  return false;
}

/** هل يُشغَّل فيديو الخلفية؟ لا مع تقليل الحركة ولا مع توفير البيانات. */
export function useMotionAllowed(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
