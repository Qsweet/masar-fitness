import type { PurchaseContext } from "@masar/db";
import {
  majorNumber,
  phoneDigitsForHash,
  phoneE164ForHash,
  type AttributionParam,
  type IntegrationConfig,
} from "@masar/domain";
import { sha256Hex } from "../hash";
import type { TrackingRequest } from "../transport";

/** ما يحتاجه كل باني: الطلب ولقطته، وإعداد المنصة، ومفتاحها مفكوكًا، ورابط الموقع الاحتياطي. */
export interface PurchaseInput {
  readonly purchase: PurchaseContext;
  readonly eventId: string;
  readonly config: IntegrationConfig;
  readonly secret: string;
  readonly siteUrl: string;
}

export interface TestInput {
  readonly config: IntegrationConfig;
  readonly secret: string;
  readonly testEventCode: string | null;
  readonly eventId: string;
  readonly siteUrl: string;
  readonly now: Date;
}

export type Built =
  | { readonly kind: "request"; readonly request: TrackingRequest; readonly eventName: string }
  | { readonly kind: "skip"; readonly reason: string };

export function skip(reason: string): Built {
  return { kind: "skip", reason };
}

export function jsonRequest(
  url: string,
  body: unknown,
  eventName: string,
  headers: Readonly<Record<string, string>> = {},
): Built {
  return {
    kind: "request",
    eventName,
    request: {
      url,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  };
}

const MS_PER_SECOND = 1000;

export function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_SECOND);
}

/** أحدث لمسة تحمل المعامل (آخر لمسة ثم الأولى)، بوقتها بالثواني. */
export function touchValue(
  purchase: PurchaseContext,
  param: AttributionParam,
): { readonly value: string; readonly at: number } | null {
  for (const touch of [purchase.lastTouch, purchase.firstTouch]) {
    const value = touch?.values[param];
    if (touch !== null && value !== undefined) {
      return { value, at: touch.at };
    }
  }
  return null;
}

/** جوال ميتا وسناب مجزّأً (أرقام بلا +)، أو null. */
export function hashedPhoneDigits(purchase: PurchaseContext): string | null {
  const digits = phoneDigitsForHash(purchase.phoneE164);
  return digits === null ? null : sha256Hex(digits);
}

/** جوال جوجل وتيك توك مجزّأً (E.164 بـ+)، أو null. */
export function hashedPhoneE164(purchase: PurchaseContext): string | null {
  const e164 = phoneE164ForHash(purchase.phoneE164);
  return e164 === null ? null : sha256Hex(e164);
}

/** معرّف العميل عندنا مجزّأً: القيمة نفسها لكل المنصات، بلا جوال. */
export function hashedExternalId(purchase: PurchaseContext): string {
  return sha256Hex(purchase.customerId);
}

export interface Line {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export function linesOf(purchase: PurchaseContext): Line[] {
  return purchase.items.map((item) => ({
    id: item.slug,
    name: purchase.locale === "en" ? item.nameEn : item.nameAr,
    price: majorNumber(item.totalMinor),
  }));
}

export function sourceUrl(purchase: PurchaseContext, siteUrl: string): string {
  return purchase.pageUrl ?? siteUrl;
}

/** يحذف المفاتيح الفارغة: المنصات ترفض `null` في حقول بيانات العميل. */
export function compact<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>;
}
