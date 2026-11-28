import { consentAllows, type Consent, type TrackingProvider } from "@masar/domain";
import type { ClientProvider, Sink } from "./types";
import { loadGtag, loadGtm } from "./vendors/google";
import { loadMeta } from "./vendors/meta";
import { loadSnap } from "./vendors/snap";
import { loadTiktok } from "./vendors/tiktok";
import { loadX } from "./vendors/x";

/** وسوم المنصات التي وافق عليها الزائر، كلٌّ مرة واحدة في عمر الصفحة. */
export function loadSinks(
  providers: readonly ClientProvider[],
  consent: Consent,
  nonce: string | undefined,
): Sink[] {
  const allowed = new Map<TrackingProvider, ClientProvider>(
    providers
      .filter((item) => consentAllows(item.provider, consent))
      .map((item) => [item.provider, item]),
  );
  const config = (provider: TrackingProvider) => allowed.get(provider)?.config ?? null;
  const gtm = config("gtm");
  const ga4 = config("ga4");
  const ads = config("google_ads");
  const meta = config("meta");
  const snap = config("snap");
  const tiktok = config("tiktok");
  const x = config("x");
  const sinks = [
    gtm === null ? null : loadGtm(gtm, consent, nonce),
    ga4 === null && ads === null ? null : loadGtag({ ga4, ads }, consent, nonce),
    meta === null ? null : loadMeta(meta, nonce),
    snap === null ? null : loadSnap(snap, nonce),
    tiktok === null ? null : loadTiktok(tiktok, nonce),
    x === null ? null : loadX(x, nonce),
  ];
  return sinks.filter((sink): sink is Sink => sink !== null);
}
