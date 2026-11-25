/** fetch محقون لاختبارات محوّل Moyasar: يسجّل الاستدعاءات ويرد بحمولات ثابتة. لا شبكة. */
import { createMoyasarProvider } from "./adapter";
import { WEBHOOK_SECRET } from "./fixtures";

export const SECRET_KEY = "sk_test_fixture-not-a-real-key";
export const BASE = "https://api.moyasar.com/v1";
export const SECOND_PAYMENT_ID = "11111111-2222-4333-8444-555555555555";
const STUB_TIMEOUT_MS = 1_000;

export interface Call {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

export type Reply = { status: number; body: unknown } | "network_error";

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

export function setup(replies: Record<string, Reply>) {
  const calls: Call[] = [];
  const fetchStub: typeof fetch = (input, init) => {
    const method = init?.method ?? "GET";
    const url = urlOf(input);
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, headers: { ...(init?.headers as Record<string, string>) }, body });
    const reply = replies[`${method} ${url.replace(BASE, "")}`];
    if (reply === undefined) {
      throw new Error(`استدعاء غير متوقع: ${method} ${url}`);
    }
    if (reply === "network_error") {
      return Promise.reject(new TypeError("fetch failed"));
    }
    return Promise.resolve(Response.json(reply.body, { status: reply.status }));
  };
  const provider = createMoyasarProvider({
    secretKey: SECRET_KEY,
    webhookSecret: WEBHOOK_SECRET,
    mode: "test",
    fetch: fetchStub,
    timeoutMs: STUB_TIMEOUT_MS,
  });
  return { provider, calls };
}

export function errorOf(result: { ok: boolean; error?: { kind: string; code: string | null } }) {
  return result.ok ? null : [result.error?.kind, result.error?.code];
}
