import "server-only";

/**
 * خانة معالجة واحدة في العملية بطابور قصير (القرار 77): فك ترميز صورة كبيرة يأخذ ذاكرة وثواني، فلا
 * تُعالج صورتان معًا. ما يصل والخانة مشغولة ينتظر دوره بالترتيب حتى `MAX_WAITING` (كل منتظر يحمل ملفه
 * وحده، 8 MiB على الأكثر)؛ ما زاد يُرفض برسالة «أعد المحاولة بعد لحظات» فلا ينمو الطابور بلا حد.
 * على globalThis كي تشترك فيها كل حزم المسارات.
 */
export const MAX_WAITING = 4;

interface Slot {
  busy: boolean;
  readonly waiting: (() => void)[];
}

const shared = globalThis as typeof globalThis & { masarImageSlot?: Slot };

function slot(): Slot {
  shared.masarImageSlot ??= { busy: false, waiting: [] };
  return shared.masarImageSlot;
}

/** يشغّل العمل حين يأتي دوره، أو يرجع null فورًا إن امتلأ الطابور. */
export async function withImageSlot<T>(work: () => Promise<T>): Promise<T | null> {
  const state = slot();
  if (state.busy) {
    if (state.waiting.length >= MAX_WAITING) {
      return null;
    }
    // الخانة تنتقل إلى المنتظر مباشرة عند تحريرها (تبقى «مشغولة»)، فلا يسبقه وافد جديد
    await new Promise<void>((resolve) => {
      state.waiting.push(resolve);
    });
  }
  state.busy = true;
  try {
    return await work();
  } finally {
    const next = state.waiting.shift();
    if (next === undefined) {
      state.busy = false;
    } else {
      next();
    }
  }
}
