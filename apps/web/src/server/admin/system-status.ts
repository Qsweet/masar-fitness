import "server-only";
import type { MfaCoverage } from "@masar/db";
import { getEnv } from "../env";

/** حالة النظام كما هي في إعداد هذا النشر وقاعدته: رموز يترجمها القاموس، لا نصوص. */
export interface SystemStatus {
  readonly checkout: "open" | "preview" | "closed";
  readonly payments:
    | { readonly mode: "off" }
    | { readonly mode: "test"; readonly provider: string };
  readonly indexing: "on" | "off";
  readonly version: string;
  readonly mfa: MfaCoverage;
}

function checkoutState(enabled: boolean, preview: boolean): SystemStatus["checkout"] {
  if (!enabled) {
    return "closed";
  }
  return preview ? "preview" : "open";
}

export function systemStatus(mfa: MfaCoverage): SystemStatus {
  const env = getEnv();
  return {
    checkout: checkoutState(env.CHECKOUT_ENABLED, env.CHECKOUT_PREVIEW),
    payments:
      env.PAYMENTS.mode === "off"
        ? { mode: "off" }
        : { mode: env.PAYMENTS.mode, provider: env.PAYMENTS.provider },
    indexing: env.SITE_INDEXABLE ? "on" : "off",
    version: env.APP_VERSION,
    mfa,
  };
}
