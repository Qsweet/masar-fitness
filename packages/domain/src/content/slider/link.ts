import { err, ok, type Result } from "../../result";
import { EXTERNAL_URL_MAX_LENGTH } from "./limits";

/**
 * رابط الشريحة (ADMIN_A3_SLIDER §3): لا شيء، أو مسار داخلي من قائمة يبنيها الخادم ويحقنها، أو رابط
 * `https` خارجي بفحص صارم. الفحص بأنماط لا بـ`URL` من المنصة (المجال بلا منصة)، والمضيف يُطبَّع صغيرًا.
 */
export const SLIDE_LINK_KINDS = ["none", "internal", "external"] as const;
export type SlideLinkKind = (typeof SLIDE_LINK_KINDS)[number];

export type SlideLink =
  | { readonly kind: "none" }
  | { readonly kind: "internal"; readonly path: string }
  | { readonly kind: "external"; readonly url: string; readonly newTab: boolean };

export interface SlideLinkInput {
  readonly kind: string;
  readonly internal: string;
  readonly external: string;
  readonly newTab: boolean;
}

/** وسم نطاق: حروف لاتينية صغيرة وأرقام وشرطات داخلية، حتى 63 محرفًا. */
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
/** اسم نطاق بنقطة واحدة على الأقل، وآخره حروف أو `xn--` (نطاق دولي مرمَّز). */
const HOST = new RegExp(`^(?:${LABEL}\\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$`);
/** ما بعد المضيف: مسار أو استعلام أو مرساة بمحارف الرابط المأمونة وحدها. */
const TAIL = /^(?:[/?#][A-Za-z0-9\-._~/?#!$&'()*+,;=%:@]*)?$/;
const HTTPS = /^https:\/\//i;
const HTTPS_PREFIX = "https://";
/** مسافة أو محرف تحكم أو تنسيق غير مرئي (علامات اتجاه). */
const UNSAFE = /[\s\p{Cc}\p{Cf}]/u;

export function parseExternalUrl(raw: string): Result<string, string> {
  const value = raw.trim();
  if (value === "") {
    return err("slider.link_required");
  }
  if (value.length > EXTERNAL_URL_MAX_LENGTH) {
    return err("slider.link_too_long");
  }
  if (!HTTPS.test(value)) {
    // ‎javascript:‎ و‎data:‎ و‎http:‎ و‎//host‎ وكل مخطط آخر
    return err("slider.link_https_only");
  }
  const rest = value.slice(HTTPS_PREFIX.length);
  const end = rest.search(/[/?#]/);
  const host = (end === -1 ? rest : rest.slice(0, end)).toLowerCase();
  const tail = end === -1 ? "" : rest.slice(end);
  // بيانات دخول (‎user:pass@‎) أو منفذ أو عنوان IP أو مضيف فارغ لا تطابق شكل المضيف
  if (UNSAFE.test(value) || !HOST.test(host) || !TAIL.test(tail)) {
    return err("slider.link_invalid");
  }
  return ok(`${HTTPS_PREFIX}${host}${tail}`);
}

/** مسار داخلي بلا لغة يطابق عنصرًا من القائمة المعروفة حرفيًا. */
export function parseInternalPath(raw: string, known: ReadonlySet<string>): Result<string, string> {
  const value = raw.trim();
  if (value === "") {
    return err("slider.link_required");
  }
  return known.has(value) ? ok(value) : err("slider.link_unknown");
}

export function parseSlideLink(
  input: SlideLinkInput,
  known: ReadonlySet<string>,
): Result<SlideLink, string> {
  switch (input.kind) {
    case "none":
      return ok({ kind: "none" });
    case "internal": {
      const path = parseInternalPath(input.internal, known);
      return path.ok ? ok({ kind: "internal", path: path.value }) : path;
    }
    case "external": {
      const url = parseExternalUrl(input.external);
      return url.ok ? ok({ kind: "external", url: url.value, newTab: input.newTab }) : url;
    }
    default:
      return err("slider.link_kind_unknown");
  }
}

/** شكل رابط محفوظ (لقطة أو صف) بلا فحص القائمة الداخلية: الفحص الكامل عند الحفظ والنشر. */
export function isStoredLink(link: SlideLink): boolean {
  switch (link.kind) {
    case "none":
      return true;
    case "internal":
      return link.path.startsWith("/") && !link.path.startsWith("//") && !UNSAFE.test(link.path);
    case "external": {
      const url = parseExternalUrl(link.url);
      return url.ok && url.value === link.url;
    }
  }
}
