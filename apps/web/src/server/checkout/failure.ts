import "server-only";
import { logger } from "../logger";

/** عطل في قراءة أو كتابة الشراء. رسالته عامة عمدًا: الخطأ الأصلي يُسجَّل منقّحًا ولا يصل للعميل. */
export class CheckoutUnavailableError extends Error {
  constructor() {
    super("checkout.unavailable");
    this.name = "CheckoutUnavailableError";
  }
}

/**
 * يسجّل عطل القاعدة بالاسم والرمز فقط: رسائل محوّل القاعدة وتفاصيل القيود قد تحمل جوال العميل،
 * فلا تُسجَّل الرسالة ولا المكدّس هنا أبدًا.
 */
export function logCheckoutFailure(event: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  logger.error(event, { errorName: name, errorCode: code });
}

/** ينفّذ عملية قاعدة، وعند العطل يسجّله منقّحًا ثم يرمي خطأً عامًا تعرضه error.tsx القائمة. */
export async function guardCheckout<T>(event: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logCheckoutFailure(event, error);
    throw new CheckoutUnavailableError();
  }
}
