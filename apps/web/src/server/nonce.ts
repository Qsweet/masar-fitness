import "server-only";
import { headers } from "next/headers";

const CSP_HEADER = "content-security-policy";
const NONCE = /'nonce-([^']+)'/u;

/** الـnonce من نص سياسة أمان المحتوى، أو غائب إن لم يوجد. */
export function nonceFromCsp(policy: string | null): string | undefined {
  return policy === null ? undefined : NONCE.exec(policy)?.[1];
}

/**
 * nonce الطلب الحالي. proxy.ts يضع السياسة كاملة في ترويسة الطلب (ومنها يقرؤه Next لسكربتاته)،
 * فنقرؤه من المكان نفسه بلا ترويسة إضافية.
 */
export async function requestNonce(): Promise<string | undefined> {
  return nonceFromCsp((await headers()).get(CSP_HEADER));
}
