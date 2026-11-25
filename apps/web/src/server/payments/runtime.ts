import "server-only";
import {
  createProvider,
  FakeProviderStore,
  type PaymentDeps,
  type PaymentLogger,
} from "@masar/payments";
import { demoPayPath } from "@/config/payments";
import { localizedPath, LOCALES, type Locale } from "@/i18n/locales";
import { getDb } from "../db";
import { getEnv } from "../env";
import { logger } from "../logger";

export interface PaymentRuntime {
  readonly deps: PaymentDeps;
  /** حالة مزوّد الاختبار إن كان هو المضبوط (صفحة الدفع التجريبية)، وإلا null. */
  readonly fakeStore: FakeProviderStore | null;
}

// على globalThis كي تشترك فيه كل حزم المسارات (صفحة الطلب، الإشعار، صفحة العرض) وتبقى ذاكرة مزوّد
// الاختبار عبر إعادة تحميل الوحدات في التطوير
const globalForPayments = globalThis as typeof globalThis & {
  masarPayments?: PaymentRuntime | null;
};

const paymentLogger: PaymentLogger = {
  info: (event, fields = {}) => {
    logger.info(event, { ...fields });
  },
  warn: (event, fields = {}) => {
    logger.warn(event, { ...fields });
  },
  error: (event, fields = {}) => {
    logger.error(event, { ...fields });
  },
};

/** لغة صفحة العودة التي طلبها العميل، لتُعرض له صفحة الدفع التجريبية بلغته. */
function localeOfReturnUrl(returnUrl: string | undefined): Locale {
  const path = returnUrl === undefined ? "" : new URL(returnUrl).pathname;
  return LOCALES.find((locale) => path.startsWith(`/${locale}/`)) ?? "ar";
}

function build(): PaymentRuntime | null {
  const { PAYMENTS, SITE_URL } = getEnv();
  if (PAYMENTS.mode === "off") {
    return null;
  }
  const clock = (): Date => new Date();
  const fakeStore = PAYMENTS.provider === "fake" ? new FakeProviderStore() : null;
  const fake =
    fakeStore === null
      ? undefined
      : {
          store: fakeStore,
          hostedPageUrl(sessionId: string): string {
            const locale = localeOfReturnUrl(fakeStore.get(sessionId)?.request.successUrl);
            return `${SITE_URL}${localizedPath(locale, demoPayPath(sessionId))}`;
          },
        };
  const provider = createProvider(PAYMENTS, {
    fetch,
    clock,
    ...(fake === undefined ? {} : { fake }),
  });
  const deps: PaymentDeps = {
    db: getDb(),
    provider,
    logger: paymentLogger,
    clock,
    minPaymentMinutes: PAYMENTS.minPaymentMinutes,
  };
  return { deps, fakeStore };
}

/**
 * الدفع الإلكتروني كما هو مضبوط في هذا النشر، أو null إن لم يُضبط مزوّد (`PAYMENTS_MODE` غائب أو
 * off): حينها لا زر دفع ولا رابط إشعار، والسلوك كما كان قبل المرحلة 4.
 */
export function getPayments(): PaymentRuntime | null {
  if (globalForPayments.masarPayments === undefined) {
    globalForPayments.masarPayments = build();
  }
  return globalForPayments.masarPayments;
}
