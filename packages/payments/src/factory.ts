/** يبني محوّل المزوّد من الإعداد المتحقَّق منه. المفاتيح تبقى داخل المحوّل ولا تُرجَع. */
import type { ActivePaymentsConfig } from "./config";
import { createFakeProvider, type FakeProviderStore } from "./fake/fake-provider";
import { createMoyasarProvider } from "./moyasar/adapter";
import type { PaymentProvider } from "./port";
import { PROVIDER_TIMEOUT_MS } from "./timing";

export interface ProviderRuntime {
  readonly fetch: typeof fetch;
  readonly clock: () => Date;
  /** حالة مزوّد الاختبار ورابط صفحته التجريبية. تلزم مع `provider: "fake"` فقط. */
  readonly fake?: {
    readonly store: FakeProviderStore;
    readonly hostedPageUrl: (sessionId: string) => string;
  };
}

export function createProvider(
  config: ActivePaymentsConfig,
  runtime: ProviderRuntime,
): PaymentProvider {
  if (config.provider === "moyasar") {
    return createMoyasarProvider({
      secretKey: config.moyasarSecretKey,
      webhookSecret: config.moyasarWebhookSecret,
      mode: config.mode,
      fetch: runtime.fetch,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
  }
  if (runtime.fake === undefined) {
    throw new Error("The fake payment provider needs its in-memory store.");
  }
  return createFakeProvider({
    store: runtime.fake.store,
    webhookSecret: config.fakeWebhookSecret,
    hostedPageUrl: runtime.fake.hostedPageUrl,
    clock: runtime.clock,
  });
}
