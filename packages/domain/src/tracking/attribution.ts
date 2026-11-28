/**
 * الإسناد في كوكي طرف أول (ADMIN_A5_TRACKING §5.1، القرار 89-4): أول لمسة لا تُستبدل، وآخر لمسة
 * تُحدَّث مع كل وصول بحملة. قبل موافقة الإعلانات تُحفظ معاملات الحملة وصفحة الهبوط وحدهما؛ معرّفات النقر
 * الإعلانية لا تُحفظ إلا مع الموافقة. القيم من رابط يكتبه أي أحد، فلكل مفتاح حد طول ونمط، وما خالف يُسقط.
 */
/**
 * `twclid` معرّف نقر X (قالب X الرسمي: «the click-through URL parameter twclid»)، القرار 90-1.
 * `oppref` معرّف نقر إعلانات ChatGPT من رابط الهبوط (https://developers.openai.com/ads/measurement-pixel)، القرار 91.
 */
export const CLICK_ID_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "ScCid",
  "ttclid",
  "twclid",
  "oppref",
] as const;
export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export const ATTRIBUTION_PARAMS = [...CLICK_ID_PARAMS, ...UTM_PARAMS] as const;
export type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number];

export const ATTRIBUTION_COOKIE = "masar_attr";
/** 90 يومًا بالثواني. */
export const ATTRIBUTION_MAX_AGE_SECONDS = 7_776_000;

/** معرّفات النقر: حروف وأرقام و`-_.` (fbclid وgclid كذلك)، حتى 512 محرفًا. */
const CLICK_ID_SHAPE = /^[A-Za-z0-9_.-]{1,512}$/;
/** قيم الحملات نص قصير بلا محارف تحكم ولا علامات تنسيق. */
const UTM_SHAPE = /^[^\p{C}<>"'`]{1,150}$/u;

export type TouchValues = Partial<Readonly<Record<AttributionParam, string>>>;

export interface Touch {
  readonly values: TouchValues;
  /** ثواني يونكس. */
  readonly at: number;
  /** مسار صفحة الهبوط بلا معاملات. */
  readonly landing?: string;
}

/** مسار يبدأ بـ/ بلا مسافات ولا علامات تنسيق، حتى 200 محرف. */
const LANDING_SHAPE = /^\/[^\s<>"'`?#]{0,199}$/u;

export interface TouchOptions {
  /** معرّفات النقر الإعلانية: فقط مع موافقة الإعلانات. */
  readonly clickIds: boolean;
  readonly landing?: string | undefined;
}

const UTM_ONLY: TouchOptions = { clickIds: false };

export interface Attribution {
  readonly first: Touch;
  readonly last: Touch;
}

function isClickId(param: AttributionParam): boolean {
  return (CLICK_ID_PARAMS as readonly string[]).includes(param);
}

function cleanValue(param: AttributionParam, value: string): string | undefined {
  const trimmed = value.trim();
  const shape = isClickId(param) ? CLICK_ID_SHAPE : UTM_SHAPE;
  return shape.test(trimmed) ? trimmed : undefined;
}

/** لمسة من معاملات الرابط، أو null إن لم يحمل الرابط معاملًا صالحًا واحدًا مسموحًا. */
export function touchFromQuery(
  read: (name: string) => string | null,
  at: number,
  options: TouchOptions = UTM_ONLY,
): Touch | null {
  const values: Partial<Record<AttributionParam, string>> = {};
  const params = options.clickIds ? ATTRIBUTION_PARAMS : UTM_PARAMS;
  for (const param of params) {
    const raw = read(param);
    const value = raw === null ? undefined : cleanValue(param, raw);
    if (value !== undefined) {
      values[param] = value;
    }
  }
  if (Object.keys(values).length === 0) {
    return null;
  }
  const landing = options.landing;
  return landing !== undefined && LANDING_SHAPE.test(landing)
    ? { values, at, landing }
    : { values, at };
}

/** معرّفات النقر بعد موافقة الإعلانات: تُضاف إلى آخر لمسة (والأولى إن لم توجد) بلا مسّ الحملة. */
export function addClickIds(existing: Attribution | null, clicks: Touch): Attribution {
  if (existing === null) {
    return { first: clicks, last: clicks };
  }
  const last = { ...existing.last, values: { ...existing.last.values, ...clicks.values } };
  return { first: existing.first, last };
}

export function mergeAttribution(existing: Attribution | null, touch: Touch): Attribution {
  return { first: existing?.first ?? touch, last: touch };
}

export function encodeAttribution(attribution: Attribution): string {
  return encodeURIComponent(JSON.stringify(attribution));
}

function landingOf(value: object): string | undefined {
  return "landing" in value && typeof value.landing === "string" ? value.landing : undefined;
}

function parseTouch(value: unknown): Touch | null {
  if (typeof value !== "object" || value === null || !("values" in value) || !("at" in value)) {
    return null;
  }
  const { values, at } = value;
  if (typeof at !== "number" || !Number.isSafeInteger(at) || typeof values !== "object") {
    return null;
  }
  const record = (values ?? {}) as Record<string, unknown>;
  const read = (name: string) => {
    const item = Object.hasOwn(record, name) ? record[name] : undefined;
    return typeof item === "string" ? item : null;
  };
  return touchFromQuery(read, at, { clickIds: true, landing: landingOf(value) });
}

/** null لكوكي غائب أو مشوّه: كل قيمة تمر بالفحص نفسه من جديد، فلا يدخل الطلب ما كتبه الزائر بيده. */
export function decodeAttribution(raw: string | undefined): Attribution | null {
  if (raw === undefined || raw === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("first" in parsed) ||
      !("last" in parsed)
    ) {
      return null;
    }
    const first = parseTouch(parsed.first);
    const last = parseTouch(parsed.last);
    return first === null || last === null ? null : { first, last };
  } catch {
    return null;
  }
}
