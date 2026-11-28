import { usesHashedPhone, type TrackingProvider } from "./providers";

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
  "purchaseEventId",
  "addToCartEventId",
  "leadEventId",
] as const;
export type TrackingField = (typeof TRACKING_FIELDS)[number];

export type IntegrationConfig = Partial<Readonly<Record<TrackingField, string>>> & {
  /** «إرسال الجوال المجزّأ» لمنصة تقبله (`usesHashedPhone`). الغائب مفعَّل (القرار 90-3). */
  readonly sendHashedPhone?: boolean;
  /**
   * OpenAI: المالك أكّد أنه أطفأ «المطابقة المتقدمة الآلية» في Ads Manager (مراجعة القرار 93). لا أمر
   * في الـSDK لإطفائها، فبلا هذا التأكيد لا يكتمل الإعداد ولا يُحمَّل البكسل ولا تتسع CSP.
   */
  readonly aamDisabled?: boolean;
};

/** منصة تشترط تأكيد إطفاء المطابقة المتقدمة الآلية قبل التفعيل. */
export function requiresAamConfirmation(provider: TrackingProvider): boolean {
  return provider === "openai";
}

const PROVIDER_FIELDS: Readonly<Record<TrackingProvider, readonly TrackingField[]>> = {
  gtm: ["containerId"],
  ga4: ["measurementId"],
  google_ads: ["conversionId", "conversionLabel"],
  meta: ["pixelId"],
  snap: ["pixelId"],
  tiktok: ["pixelId"],
  x: ["pixelId", "purchaseEventId", "addToCartEventId", "leadEventId"],
  openai: ["pixelId"],
};

/** حقول لا يشترطها التفعيل: حدث X الذي لم يُنشئه المالك في Ads Manager لا يُرسل. */
const OPTIONAL_FIELDS: ReadonlySet<TrackingField> = new Set(["addToCartEventId", "leadEventId"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** معرّف X Pixel: خمسة محارف (نمط قالب X الرسمي لـGTM: github.com/twitter/google-tag-manager-base-tag). */
const X_PIXEL = /^[A-Za-z0-9]{5}$/;
/** معرّف حدث X: ‎tw-<البكسل>-<الحدث>‎ (قالب X الرسمي للأحداث: github.com/twitter/google-tag-manager-event-tag). */
const X_EVENT = /^(tw|TW)-([A-Za-z0-9]{5})-[A-Za-z0-9]{5}$/;

/** نمط كل حقل لكل منصة: `pixelId` يختلف بين ميتا (أرقام) وسناب (UUID) وتيك توك (رمز) وX. */
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
    case "purchaseEventId":
    case "addToCartEventId":
    case "leadEventId":
      return X_EVENT;
  }
}

/**
 * Pixel ID لإعلانات ChatGPT: وثائق OpenAI لا تنشر صيغته (مثالها الوحيد مقطوع «134534…» في
 * https://developers.openai.com/ads/api-reference/conversion-setup)، فالنمط محارف آمنة بطول محدود:
 * القيمة تدخل نص سكربت ورابط `?pid=`، فلا محرف خارج هذا المدى (القرار 93).
 */
const OPENAI_PIXEL = /^[A-Za-z0-9_-]{6,64}$/;

const PIXEL_PATTERNS: Partial<Readonly<Record<TrackingProvider, RegExp>>> = {
  snap: UUID,
  tiktok: /^[A-Z0-9]{10,30}$/,
  x: X_PIXEL,
  openai: OPENAI_PIXEL,
};
/** ميتا (ومن لا نمط بكسل له): أرقام. */
const NUMERIC_PIXEL = /^\d{8,20}$/;

function pixelPattern(provider: TrackingProvider): RegExp {
  return PIXEL_PATTERNS[provider] ?? NUMERIC_PIXEL;
}

/** معرّف حدث X لبكسل آخر: البكسل يقرأ الجزء الأوسط بكسلًا للحدث (`parseEventCodeId` في uwt.js). */
function belongsToPixel(value: string, pixelId: string | undefined): boolean {
  const pixel = X_EVENT.exec(value)?.[2];
  return pixelId === undefined || pixel?.toLowerCase() === pixelId.toLowerCase();
}

/** رمز أحداث الاختبار (ميتا وتيك توك): حروف وأرقام فقط، يُرسل في الجسم لا في رابط. */
const TEST_EVENT_CODE = /^[A-Za-z0-9_-]{4,40}$/;

export function fieldsOf(provider: TrackingProvider): readonly TrackingField[] {
  return PROVIDER_FIELDS[provider];
}

export function isOptionalField(field: TrackingField): boolean {
  return OPTIONAL_FIELDS.has(field);
}

/** المنصات التي تقبل رمز أحداث اختبار في الجسم (§4.3)؛ GA4 وسناب لهما نقطة تحقق منفصلة. */
export function acceptsTestEventCode(provider: TrackingProvider): boolean {
  return provider === "meta" || provider === "tiktok";
}

export function isValidTestEventCode(value: string): boolean {
  return TEST_EVENT_CODE.test(value);
}

/** الجوال المجزّأ يخرج لهذه المنصة: تقبله، ولم يُطفئه المالك. */
export function sendsHashedPhone(provider: TrackingProvider, config: IntegrationConfig): boolean {
  return usesHashedPhone(provider) && config.sendHashedPhone !== false;
}

export type ConfigIssue = "invalid" | "required" | "pixel_mismatch";

export interface ParsedConfig {
  readonly config: IntegrationConfig;
  readonly issues: Readonly<Partial<Record<TrackingField, ConfigIssue>>>;
}

function issueOf(
  provider: TrackingProvider,
  field: TrackingField,
  value: string,
  pixelId: string | undefined,
): ConfigIssue | null {
  if (!patternOf(provider, field).test(value)) {
    return "invalid";
  }
  const eventField = provider === "x" && field !== "pixelId";
  return !eventField || belongsToPixel(value, pixelId) ? null : "pixel_mismatch";
}

/**
 * يتحقق من حقول المنصة وحدها (ما سواها يُسقط). الفارغ مسموح للحفظ بلا تفعيل؛ مع التفعيل كل حقل
 * غير اختياري مطلوب، فلا يُحمَّل وسم بنصف إعداد. معرّف حدث X لبكسل آخر مرفوض.
 */
export function parseIntegrationConfig(
  provider: TrackingProvider,
  raw: Readonly<Record<string, string>>,
  enabled: boolean,
): ParsedConfig {
  const read = (field: TrackingField) =>
    (Object.hasOwn(raw, field) ? (raw[field] ?? "") : "").trim();
  // معرّف حدث X يُطابَق ببكسل صالح وحده؛ البكسل الخاطئ له خطؤه
  const pixelId = X_PIXEL.test(read("pixelId")) ? read("pixelId") : undefined;
  const config: Partial<Record<TrackingField, string>> = {};
  const issues: Partial<Record<TrackingField, ConfigIssue>> = {};
  for (const field of fieldsOf(provider)) {
    const value = read(field);
    const issue = value === "" ? null : issueOf(provider, field, value, pixelId);
    if (value === "") {
      if (enabled && !isOptionalField(field)) {
        issues[field] = "required";
      }
    } else if (issue === null) {
      config[field] = value;
    } else {
      issues[field] = issue;
    }
  }
  return { config, issues };
}

/**
 * إعداد محفوظ صالح للتحميل الآن: كل حقل مطلوب موجود وبنمطه، والاختياري بنمطه إن وُجد، ولـOpenAI
 * تأكيد إطفاء المطابقة المتقدمة الآلية.
 */
export function isCompleteConfig(provider: TrackingProvider, config: IntegrationConfig): boolean {
  if (requiresAamConfirmation(provider) && config.aamDisabled !== true) {
    return false;
  }
  return fieldsOf(provider).every((field) => {
    const value = config[field];
    if (value === undefined) {
      return isOptionalField(field);
    }
    return issueOf(provider, field, value, config.pixelId) === null;
  });
}
