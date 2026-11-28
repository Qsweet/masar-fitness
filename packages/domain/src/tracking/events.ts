import type { TrackingProvider } from "./providers";

/**
 * الأحداث القياسية (ADMIN_A5_TRACKING §2): الاسم عندنا اسم GA4، ولكل منصة اسمها. تعريف واحد في
 * مكان واحد (ANALYTICS §1-3)؛ المتصفح والخادم يترجمان من هنا.
 */
export const TRACK_EVENTS = [
  "page_view",
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "generate_lead",
  "purchase",
] as const;
export type TrackEvent = (typeof TRACK_EVENTS)[number];

/** منصات بأسماء أحداث قياسية ثابتة. X بلا أسماء: لكل حدث معرّف يُنشأ في Ads Manager (`ids.ts`). */
export type PixelProvider = Exclude<TrackingProvider, "gtm" | "ga4" | "google_ads" | "x">;

const PIXEL_NAMES: Readonly<Record<PixelProvider, Readonly<Record<TrackEvent, string>>>> = {
  meta: {
    page_view: "PageView",
    view_item: "ViewContent",
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout",
    generate_lead: "Lead",
    purchase: "Purchase",
  },
  snap: {
    page_view: "PAGE_VIEW",
    view_item: "VIEW_CONTENT",
    add_to_cart: "ADD_CART",
    begin_checkout: "START_CHECKOUT",
    generate_lead: "SIGN_UP",
    purchase: "PURCHASE",
  },
  tiktok: {
    page_view: "Pageview",
    view_item: "ViewContent",
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout",
    generate_lead: "Contact",
    purchase: "CompletePayment",
  },
};

/** اسم الحدث في بكسل المنصة وواجهتها الخادمية (الاسم نفسه شرط إزالة التكرار). */
export function pixelEventName(provider: PixelProvider, event: TrackEvent): string {
  return PIXEL_NAMES[provider][event];
}

/** معرّف الشراء مشتق من الطلب: المتصفح والخادم يكتبانه بلا تنسيق، والإعادة لا تكرره (§2.1). */
export function purchaseEventId(orderId: string): string {
  return `purchase.${orderId}`;
}

const MINOR_PER_MAJOR = 100;
const MINOR_DIGITS = 2;

/** الهللات إلى ريال بخانتين نصًّا («149.50»)، بلا قسمة عشرية. */
export function majorAmount(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const major = Math.trunc(absolute / MINOR_PER_MAJOR);
  const minor = String(absolute % MINOR_PER_MAJOR).padStart(MINOR_DIGITS, "0");
  return `${sign}${String(major)}.${minor}`;
}

/** القيمة رقمًا كما تطلبه الحمولات (JSON number)، من النص المضبوط أعلاه. */
export function majorNumber(amountMinor: number): number {
  return Number(majorAmount(amountMinor));
}

export interface TrackItem {
  readonly id: string;
  readonly name: string;
  readonly amountMinor: number;
}
