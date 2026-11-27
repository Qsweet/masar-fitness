/**
 * الناقل منفذ يُحقن (ADMIN_A5_TRACKING §10): الإنتاج `fetchTransport`، والاختبارات وخادم e2e
 * `createFakeTransport`، فلا يخرج من اختبار طلب إلى منصة. الرد يُقرأ نصًّا محدودًا ولا يُسجَّل.
 */
export interface TrackingRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type TransportResult =
  | { readonly kind: "response"; readonly status: number; readonly body: string }
  | { readonly kind: "network"; readonly reason: "timeout" | "network" };

export type TrackingTransport = (request: TrackingRequest) => Promise<TransportResult>;

/** مهلة كل طلب: يُبنى عليها حجز المرسِل (`leaseFor`). */
export const TRANSPORT_TIMEOUT_MS = 10_000;
/** ما يُقرأ من جسم الرد: يكفي لرمز خطأ تيك توك وعدد رسائل تحقق GA4. */
const MAX_BODY_CHARS = 4096;

export function fetchTransport(fetchImpl: typeof fetch): TrackingTransport {
  return async (request) => {
    try {
      const response = await fetchImpl(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(TRANSPORT_TIMEOUT_MS),
        redirect: "error",
      });
      const body = (await response.text()).slice(0, MAX_BODY_CHARS);
      return { kind: "response", status: response.status, body };
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === "TimeoutError";
      return { kind: "network", reason: timeout ? "timeout" : "network" };
    }
  };
}

export interface FakeTransport {
  readonly transport: TrackingTransport;
  readonly requests: TrackingRequest[];
  /** الرد التالي (الافتراضي 200 بجسم فارغ)، يُستعمل لكل الطلبات حتى يُغيَّر. */
  respondWith: (result: TransportResult) => void;
}

const OK_STATUS = 200;

/** ناقل وهمي بسجل طلبات: لا شبكة. */
export function createFakeTransport(): FakeTransport {
  const requests: TrackingRequest[] = [];
  let next: TransportResult = { kind: "response", status: OK_STATUS, body: "" };
  return {
    requests,
    transport: (request) => {
      requests.push(request);
      return Promise.resolve(next);
    },
    respondWith: (result) => {
      next = result;
    },
  };
}
