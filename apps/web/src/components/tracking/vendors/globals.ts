/**
 * الدوال العامة التي تنتظرها سكربتات المنصات على `window`، بالشكل الذي تنشئه شيفراتها الأساسية
 * الرسمية: طابور يُملأ قبل وصول السكربت ثم يفرّغه السكربت. القيم `unknown`: نحن لا نقرأ منها شيئًا.
 */
export interface QueueStub {
  (...args: unknown[]): void;
  queue: unknown[];
}

export interface MetaStub extends QueueStub {
  callMethod?: (...args: unknown[]) => void;
  push: MetaStub;
  loaded: boolean;
  version: string;
}

export interface SnapStub extends QueueStub {
  handleRequest?: (...args: unknown[]) => void;
}

export interface XStub extends QueueStub {
  exe?: (...args: unknown[]) => void;
  version: string;
}

export interface TiktokStub extends Array<unknown> {
  methods: readonly string[];
  load: (pixelId: string) => void;
  page: (...args: unknown[]) => void;
  track: (...args: unknown[]) => void;
  identify: (...args: unknown[]) => void;
  _i?: Record<string, unknown[] & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: MetaStub;
    _fbq?: MetaStub;
    snaptr?: SnapStub;
    ttq?: TiktokStub;
    twq?: XStub;
    /** طابور OpenAI من `OpenaiStub` (شيفرته الرسمية). */
    oaiq?: (...args: unknown[]) => void;
    TiktokAnalyticsObject?: string;
  }
}

/** سكربت المنصة غير متزامن، بالـnonce نفسه (GTM ينقله لوسومه)، في رأس الصفحة. */
export function injectScript(src: string, nonce: string | undefined): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  if (nonce !== undefined) {
    script.nonce = nonce;
  }
  document.head.appendChild(script);
}
