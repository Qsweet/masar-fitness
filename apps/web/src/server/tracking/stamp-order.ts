import "server-only";
import { recordOrderTracking, type OrderTrackingInput } from "@masar/db";
import {
  ATTRIBUTION_COOKIE,
  CLICK_ID_PARAMS,
  type Touch,
  CONSENT_COOKIE,
  decodeAttribution,
  gaClientId,
  metaCookie,
  parseConsent,
  vendorCookie,
} from "@masar/domain";
import { cookies, headers } from "next/headers";
import { getDb } from "../db";
import { getEnv } from "../env";
import { clientIp, UNKNOWN_CLIENT_IP } from "../http/client-ip";
import { logger } from "../logger";

const MS_PER_SECOND = 1000;
const MAX_USER_AGENT = 512;

type Read = (name: string) => string | undefined;

function consentOf(read: Read): OrderTrackingInput["consent"] {
  const consent = parseConsent(read(CONSENT_COOKIE));
  if (consent === null) {
    return { analytics: false, ads: false, version: null, at: null };
  }
  const at = new Date(consent.at * MS_PER_SECOND);
  return { analytics: consent.analytics, ads: consent.ads, version: consent.version, at };
}

/** معرّفات الإعلانات وعنوان الزائر ووكيله: بموافقة الإعلانات وحدها. */
function adIdentifiers(read: Read, requestHeaders: Headers) {
  const ip = clientIp(requestHeaders.get("x-forwarded-for"));
  return {
    fbp: metaCookie(read("_fbp")),
    fbc: metaCookie(read("_fbc")),
    scid: vendorCookie(read("_scid")),
    ttp: vendorCookie(read("_ttp")),
    // مرجع متصفح OpenAI من كوكي البكسل، بموافقة الإعلانات (Conversions API: «user.obref»)
    obref: vendorCookie(read("__obref")),
    clientIp: ip === UNKNOWN_CLIENT_IP ? null : ip,
    userAgent: requestHeaders.get("user-agent")?.slice(0, MAX_USER_AGENT) ?? null,
  };
}

/** سُحبت موافقة الإعلانات بعد حفظ معرّف نقر: لا يُختم مع الطلب، والحملة تبقى. */
export function touchFor(touch: Touch | undefined, ads: boolean): Touch | null {
  if (touch === undefined) {
    return null;
  }
  if (ads) {
    return touch;
  }
  const values = Object.fromEntries(
    Object.entries(touch.values).filter(
      ([key]) => !(CLICK_ID_PARAMS as readonly string[]).includes(key),
    ),
  );
  return Object.keys(values).length === 0 ? null : { ...touch, values };
}

const NO_AD_IDENTIFIERS = {
  fbp: null,
  fbc: null,
  scid: null,
  ttp: null,
  obref: null,
  clientIp: null,
  userAgent: null,
};

/**
 * يختم الموافقة والإسناد ومعرّفات المتصفح على الطلب بعد إنشائه (ADMIN_A5_TRACKING §5.2). المعرّفات
 * لا تُحفظ إلا بموافقة فئتها لحظة الطلب: `_ga` للتحليلات، والبقية والعنوان والوكيل للإعلانات. فشل الختم
 * يُسجَّل ولا يُسقط الطلب: بلا سطر لا يُرسل للطلب أي تحويل (الاتجاه الآمن).
 */
export async function stampOrderTracking(orderId: string, pagePath: string): Promise<void> {
  try {
    const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
    const read: Read = (name) => jar.get(name)?.value;
    const consent = consentOf(read);
    const attribution = decodeAttribution(read(ATTRIBUTION_COOKIE));
    await recordOrderTracking(getDb(), {
      orderId,
      consent,
      firstTouch: touchFor(attribution?.first, consent.ads),
      lastTouch: touchFor(attribution?.last, consent.ads),
      gaClientId: consent.analytics ? gaClientId(read("_ga")) : null,
      ...(consent.ads ? adIdentifiers(read, requestHeaders) : NO_AD_IDENTIFIERS),
      pageUrl: new URL(pagePath, getEnv().SITE_URL).toString(),
      now: new Date(),
    });
  } catch (error) {
    logger.error("tracking.order_stamp_failed", { error });
  }
}
