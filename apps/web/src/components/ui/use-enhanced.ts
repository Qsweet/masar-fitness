import { useSyncExternalStore } from "react";

const subscribeNever = (): (() => void) => () => undefined;

/**
 * هل JavaScript يعمل في المتصفح؟ false على الخادم وفي أول رسم، فما يُخفى أو يُضاف به لا يغيب عمن
 * يتصفح بلاه.
 */
export function useEnhanced(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
