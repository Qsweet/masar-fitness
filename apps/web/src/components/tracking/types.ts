import type { IntegrationConfig, TrackEvent, TrackingProvider } from "@masar/domain";

/** منصة مفعّلة كما تصل المتصفح: معرّفاتها العامة وحدها (لا مفتاح خادمي أبدًا). */
export interface ClientProvider {
  readonly provider: TrackingProvider;
  readonly config: IntegrationConfig;
}

export interface TrackLine {
  readonly id: string;
  readonly name: string;
  /** بالريال، يكتبها الخادم من الهللة (`majorNumber`). */
  readonly price: number;
}

/** حمولة الحدث في المتصفح. القيم كلها يكتبها الخادم في الصفحة، لا يحسبها المتصفح. */
export interface TrackPayload {
  readonly eventId: string;
  readonly value?: number;
  readonly currency?: string;
  readonly lines?: readonly TrackLine[];
  /** مرجع الطلب للشراء: `transaction_id` عند Google وSnap. */
  readonly transactionId?: string;
  /** نوع الاهتمام في نموذج الاستفسار (قائمة مغلقة). */
  readonly interest?: string;
  /** الجوال E.164 مجزّأً على الخادم، للشراء مع موافقة الإعلانات فقط. */
  readonly sha256Phone?: string;
}

export interface TrackCall {
  readonly event: TrackEvent;
  readonly payload: TrackPayload;
}

/** وجهة واحدة محمَّلة (منصة): ترسل الحدث بلغتها. */
export interface Sink {
  readonly send: (call: TrackCall) => void;
}
