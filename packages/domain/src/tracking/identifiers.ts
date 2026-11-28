/**
 * تطبيع المعرّفات قبل التجزئة وصيغ كوكيات المنصات (ADMIN_A5_TRACKING §4.4). الجوال يصل هنا بصيغة
 * E.164 من `parseSaudiMobile`؛ كل منصة تطلب صيغتها.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

/** ميتا وسناب: أرقام فقط بمفتاح الدولة، بلا `+` ولا صفر بادئ. */
export function phoneDigitsForHash(e164: string): string | null {
  return E164.test(e164) ? e164.slice(1) : null;
}

/** Google Ads وTikTok: E.164 كما هو بـ`+`. */
export function phoneE164ForHash(e164: string): string | null {
  return E164.test(e164) ? e164 : null;
}

/** `_ga` بصيغة ‎GA1.1.<رقم>.<ثواني>‎: معرّف العميل هو الجزآن الأخيران (Measurement Protocol). */
const GA_COOKIE = /^GA\d\.\d\.(\d{1,20}\.\d{1,20})$/;

export function gaClientId(cookie: string | undefined): string | null {
  return GA_COOKIE.exec(cookie ?? "")?.[1] ?? null;
}

/** صيغة `_fbc` و`_fbp`: ‎fb.<فهرس النطاق>.<ملي ثانية>.<قيمة>‎. */
const FB_COOKIE = /^fb\.\d\.\d{10,14}\.[A-Za-z0-9_.-]{1,512}$/;

export function metaCookie(value: string | undefined): string | null {
  return value !== undefined && FB_COOKIE.test(value) ? value : null;
}

/** `fbc` من `fbclid` حين لا كوكي: فهرس النطاق 1 (النطاق الأساسي) ووقت أول رؤية بالملي ثانية. */
export function fbcFromClickId(fbclid: string, firstSeenMs: number): string {
  return `fb.1.${String(firstSeenMs)}.${fbclid}`;
}

/** كوكيات سناب وتيك توك (`_scid`، `_ttp`): نص قصير بمحارف آمنة، وإلا لا يُرسل. */
const VENDOR_COOKIE = /^[A-Za-z0-9_.:-]{8,200}$/;

export function vendorCookie(value: string | undefined): string | null {
  return value !== undefined && VENDOR_COOKIE.test(value) ? value : null;
}

/**
 * كوكي `__oppref` الذي يكتبه بكسل OpenAI (مراجعة القرار 93): `oppref` «opaque» تمرّره الوثيقة «without
 * modification»، فلا نمط محارف له؛ الحد طول 512 وبلا محارف تحكم، وما خالف لا يُحفظ.
 */
const OPPREF_COOKIE = /^[^\p{Cc}]{1,512}$/u;

export function opprefCookie(value: string | undefined): string | null {
  return value !== undefined && OPPREF_COOKIE.test(value) ? value : null;
}
