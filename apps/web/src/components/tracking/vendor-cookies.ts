import type { Consent, ConsentCategory } from "@masar/domain";

/**
 * كوكيات المنصات على نطاقنا (طرف أول) تُمحى عند سحب فئتها (القرار 89-8)، قبل إعادة التحميل: Google
 * (`_ga`، `_ga_*`، `_gid`، `_gat*`، `_gcl_*`)، Meta (`_fbp`، `_fbc`)، TikTok (`_ttp`، `_tt_*`،
 * `ttcsid*`)، Snap (`_scid*`، `_sctr`)، X (`_twclid`، `_twpid`، `_twsid`، أسماؤها في uwt.js الرسمي). المحو على النطاق نفسه وعلى كل نطاق أب عدا المستوى الأعلى، لأن
 * الوسوم تكتبها على النطاق الأب.
 */
const PATTERNS: readonly (readonly [RegExp, ConsentCategory])[] = [
  [/^_ga(_|$)/, "analytics"],
  [/^_gid$/, "analytics"],
  [/^_gat/, "analytics"],
  [/^_gcl_/, "ads"],
  [/^_fb[pc]$/, "ads"],
  [/^_ttp$/, "ads"],
  [/^_tt_/, "ads"],
  [/^ttcsid/, "ads"],
  [/^_scid/, "ads"],
  [/^_sctr$/, "ads"],
  [/^_tw(clid|pid|sid)$/, "ads"],
];

export interface CookieJar {
  cookie: string;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** النطاق نفسه وآباؤه بلا المستوى الأعلى: ‎www.example.com ← example.com‎. لا شيء لعنوان IP أو localhost. */
export function domainVariants(hostname: string): string[] {
  const labels = hostname.split(".");
  if (IPV4.test(hostname) || labels.length < 2) {
    return [];
  }
  return labels.slice(0, -1).map((_, index) => labels.slice(index).join("."));
}

function withdrawn(before: Consent | null, after: Consent): Set<ConsentCategory> {
  const categories = new Set<ConsentCategory>();
  if (before?.analytics === true && !after.analytics) {
    categories.add("analytics");
  }
  if (before?.ads === true && !after.ads) {
    categories.add("ads");
  }
  return categories;
}

/** يمحو كوكيات الفئات المسحوبة ويرجع أسماءها. لا شيء إن لم تُسحب فئة. */
export function expireVendorCookies(
  jar: CookieJar,
  hostname: string,
  before: Consent | null,
  after: Consent,
): string[] {
  const categories = withdrawn(before, after);
  const names = jar.cookie
    .split("; ")
    .map((part) => part.split("=")[0] ?? "")
    .filter((name) =>
      PATTERNS.some(([pattern, category]) => categories.has(category) && pattern.test(name)),
    );
  for (const name of names) {
    jar.cookie = `${name}=; Max-Age=0; Path=/`;
    for (const domain of domainVariants(hostname)) {
      jar.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`;
    }
  }
  return names;
}
