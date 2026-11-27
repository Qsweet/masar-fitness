/**
 * إعداد القياس لنادي الموقع العام (ADMIN_A5_TRACKING §5.3): المنصات المفعّلة بإعداد مكتمل ومعرّفاتها
 * العامة، بلا مفاتيح. الوسيط (CSP) والصفحات (الوسوم) يقرآن الذاكرة نفسها على `globalThis` لثلاثين ثانية،
 * وحفظ اللوحة يفرّغها. القاعدة معطلة ⇒ لا منصات (لا وسم ولا CSP موسَّعة).
 * بلا `server-only`: يستورده الوسيط، وهو كود خادم لا يصل المتصفح.
 */
import type { Db } from "@masar/db";
import { isCompleteConfig, type IntegrationConfig, type TrackingProvider } from "@masar/domain";

export interface SiteProvider {
  readonly provider: TrackingProvider;
  readonly config: IntegrationConfig;
}

export interface SiteTracking {
  readonly providers: readonly SiteProvider[];
}

/** ترويسة الطلب الداخلية بأسماء المنصات التي فتحتها CSP لهذا الطلب؛ ما يرسله العميل بها يُستبدل. */
export const TRACKING_HEADER = "x-masar-tracking";

const NOTHING: SiteTracking = { providers: [] };
const TTL_MS = 30_000;

interface CacheEntry {
  readonly value: SiteTracking;
  readonly at: number;
}

type TrackingGlobal = typeof globalThis & {
  masarDb?: Db;
  masarSiteTracking?: CacheEntry | undefined;
  masarSiteTrackingLoad?: Promise<SiteTracking> | undefined;
};

const store = globalThis as TrackingGlobal;

/** عميل القاعدة نفسه الذي يحفظه `server/db.ts` على globalThis، أو عميل جديد بالعنوان من البيئة. */
async function sharedDb(): Promise<Db | null> {
  if (store.masarDb !== undefined) {
    return store.masarDb;
  }
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    return null;
  }
  const { createDb } = await import("@masar/db");
  store.masarDb ??= createDb(url);
  return store.masarDb;
}

async function load(): Promise<SiteTracking> {
  try {
    const db = await sharedDb();
    if (db === null) {
      return NOTHING;
    }
    const { siteIntegrations } = await import("@masar/db");
    const rows = await siteIntegrations(db);
    return {
      providers: rows
        .filter((row) => row.enabled && isCompleteConfig(row.provider, row.config))
        .map((row) => ({ provider: row.provider, config: row.config })),
    };
  } catch {
    return NOTHING;
  }
}

/** الإعداد من الذاكرة إن كانت حديثة، وإلا قراءة واحدة يشترك فيها كل من ينتظر. */
export async function siteTracking(now = Date.now()): Promise<SiteTracking> {
  const cached = store.masarSiteTracking;
  if (cached !== undefined && now - cached.at < TTL_MS) {
    return cached.value;
  }
  store.masarSiteTrackingLoad ??= load().then((value) => {
    store.masarSiteTracking = { value, at: Date.now() };
    store.masarSiteTrackingLoad = undefined;
    return value;
  });
  return store.masarSiteTrackingLoad;
}

/** بعد حفظ من اللوحة: القراءة التالية من القاعدة. */
export function invalidateSiteTracking(): void {
  store.masarSiteTracking = undefined;
}

export function enabledProviders(tracking: SiteTracking): TrackingProvider[] {
  return tracking.providers.map((item) => item.provider);
}
