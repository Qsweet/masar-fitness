import type { TrackingProvider } from "./providers";

/**
 * المعرّفات العامة لكل منصة وأنماطها (ADMIN_A5_TRACKING §8). المعرّف يدخل رابط سكربت ونص CSP، فكل
 * قيمة بنمط حرفي صارم لا بطول فقط؛ ما خالف يُرفض ولا يُصلَح.
 */
export const TRACKING_FIELDS = [
  "containerId",
  "measurementId",
  "conversionId",
  "conversionLabel",
  "pixelId",
] as const;
export type TrackingField = (typeof TRACKING_FIELDS)[number];

export type IntegrationConfig = Partial<Readonly<Record<TrackingField, string>>>;

const PROVIDER_FIELDS: Readonly<Record<TrackingProvider, readonly TrackingField[]>> = {
  gtm: ["containerId"],
  ga4: ["measurementId"],
  google_ads: ["conversionId", "conversionLabel"],
  meta: ["pixelId"],
  snap: ["pixelId"],
  tiktok: ["pixelId"],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** نمط كل حقل لكل منصة: `pixelId` يختلف بين ميتا (أرقام) وسناب (UUID) وتيك توك (رمز). */
function patternOf(provider: TrackingProvider, field: TrackingField): RegExp {
  switch (field) {
    case "containerId":
      return /^GTM-[A-Z0-9]{4,12}$/;
    case "measurementId":
      return /^G-[A-Z0-9]{4,16}$/;
    case "conversionId":
      return /^AW-\d{6,14}$/;
    case "conversionLabel":
      return /^[A-Za-z0-9_-]{4,40}$/;
    case "pixelId":
      return pixelPattern(provider);
  }
}

function pixelPattern(provider: TrackingProvider): RegExp {
  if (provider === "snap") {
    return UUID;
  }
  return provider === "tiktok" ? /^[A-Z0-9]{10,30}$/ : /^\d{8,20}$/;
}

/** رمز أحداث الاختبار (ميتا وتيك توك): حروف وأرقام فقط، يُرسل في الجسم لا في رابط. */
const TEST_EVENT_CODE = /^[A-Za-z0-9_-]{4,40}$/;

export function fieldsOf(provider: TrackingProvider): readonly TrackingField[] {
  return PROVIDER_FIELDS[provider];
}

/** المنصات التي تقبل رمز أحداث اختبار في الجسم (§4.3)؛ GA4 وسناب لهما نقطة تحقق منفصلة. */
export function acceptsTestEventCode(provider: TrackingProvider): boolean {
  return provider === "meta" || provider === "tiktok";
}

export function isValidTestEventCode(value: string): boolean {
  return TEST_EVENT_CODE.test(value);
}

export type ConfigIssue = "invalid" | "required";

export interface ParsedConfig {
  readonly config: IntegrationConfig;
  readonly issues: Readonly<Partial<Record<TrackingField, ConfigIssue>>>;
}

/**
 * يتحقق من حقول المنصة وحدها (ما سواها يُسقط). الفارغ مسموح للحفظ بلا تفعيل؛ مع التفعيل كل حقل
 * المنصة مطلوب، فلا يُحمَّل وسم بنصف إعداد.
 */
export function parseIntegrationConfig(
  provider: TrackingProvider,
  raw: Readonly<Record<string, string>>,
  enabled: boolean,
): ParsedConfig {
  const config: Partial<Record<TrackingField, string>> = {};
  const issues: Partial<Record<TrackingField, ConfigIssue>> = {};
  for (const field of fieldsOf(provider)) {
    const value = (Object.hasOwn(raw, field) ? (raw[field] ?? "") : "").trim();
    if (value === "") {
      if (enabled) {
        issues[field] = "required";
      }
    } else if (patternOf(provider, field).test(value)) {
      config[field] = value;
    } else {
      issues[field] = "invalid";
    }
  }
  return { config, issues };
}

/** إعداد محفوظ صالح للتحميل الآن: كل حقل المنصة موجود وبنمطه (القاعدة لا تُؤتمن على الشكل). */
export function isCompleteConfig(provider: TrackingProvider, config: IntegrationConfig): boolean {
  return fieldsOf(provider).every((field) => {
    const value = config[field];
    return value !== undefined && patternOf(provider, field).test(value);
  });
}
