import "server-only";

/**
 * خانة معالجة واحدة في العملية (القرار 77): فك ترميز صورة كبيرة يأخذ مئات الميغابايتات وثواني، فلا تُعالج
 * صورتان معًا. الرفع والخانة مشغولة يُرفض برسالة («أعد المحاولة بعد لحظات») بدل طابور ينمو في الذاكرة.
 * على globalThis كي تشترك فيها كل حزم المسارات.
 */
const shared = globalThis as typeof globalThis & { masarImageSlotBusy?: boolean };

/** يشغّل العمل إن كانت الخانة فارغة، وإلا يرجع null دون أن يشغّله. */
export async function withImageSlot<T>(work: () => Promise<T>): Promise<T | null> {
  if (shared.masarImageSlotBusy === true) {
    return null;
  }
  shared.masarImageSlotBusy = true;
  try {
    return await work();
  } finally {
    shared.masarImageSlotBusy = false;
  }
}
