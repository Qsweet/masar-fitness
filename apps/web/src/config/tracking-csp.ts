import type { TrackingProvider } from "@masar/domain";

/**
 * مضيفات كل منصة في CSP (ADMIN_A5_TRACKING §6)، من جدول Google الرسمي
 * (https://developers.google.com/tag-platform/security/guides/csp) وقوالب Snap وTikTok الرسمية.
 * السكربتات لا تحتاج مضيفًا: `'strict-dynamic'` يثق بما يحمّله سكربتنا ذو الـnonce. تُضاف لمنصة مفعّلة
 * فقط، ولصفحات الموقع لا اللوحة.
 */
export interface CspExtension {
  readonly connect: readonly string[];
  readonly img: readonly string[];
  readonly frame: readonly string[];
}

export const EMPTY_CSP_EXTENSION: CspExtension = { connect: [], img: [], frame: [] };

const GTM = "https://www.googletagmanager.com";
const GOOGLE = "https://www.google.com";
const GOOGLE_SA = "https://www.google.com.sa";

const HOSTS: Readonly<Record<TrackingProvider, CspExtension>> = {
  gtm: { connect: [GTM, GOOGLE], img: [GTM], frame: [GTM] },
  ga4: {
    connect: [GTM, "https://*.google-analytics.com", "https://*.google.com"],
    img: [GTM, "https://*.google-analytics.com"],
    frame: [],
  },
  google_ads: {
    connect: [
      GTM,
      "https://www.googleadservices.com",
      "https://googleads.g.doubleclick.net",
      "https://pagead2.googlesyndication.com",
      GOOGLE,
      GOOGLE_SA,
      "https://ad.doubleclick.net",
    ],
    img: [
      GTM,
      "https://www.googleadservices.com",
      "https://googleads.g.doubleclick.net",
      "https://pagead2.googlesyndication.com",
      GOOGLE,
      GOOGLE_SA,
    ],
    frame: [GTM],
  },
  meta: {
    connect: ["https://www.facebook.com", "https://connect.facebook.net"],
    img: ["https://www.facebook.com"],
    frame: [],
  },
  snap: { connect: ["https://tr.snapchat.com"], img: ["https://tr.snapchat.com"], frame: [] },
  tiktok: {
    connect: ["https://analytics.tiktok.com"],
    img: ["https://analytics.tiktok.com"],
    frame: [],
  },
};

function union(lists: readonly (readonly string[])[]): string[] {
  return [...new Set(lists.flat())].sort();
}

/** ما تضيفه المنصات المفعّلة، بلا تكرار وبترتيب ثابت. بلا منصة: لا شيء. */
export function trackingCsp(providers: readonly TrackingProvider[]): CspExtension {
  const extensions = providers.map((provider) => HOSTS[provider]);
  return {
    connect: union(extensions.map((item) => item.connect)),
    img: union(extensions.map((item) => item.img)),
    frame: union(extensions.map((item) => item.frame)),
  };
}
