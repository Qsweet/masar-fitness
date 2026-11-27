import "server-only";
import {
  listIntegrations,
  listRecentTrackingEvents,
  type IntegrationView,
  type TrackingEventRow,
} from "@masar/db";
import {
  isCompleteConfig,
  isServerProvider,
  TRACKING_PROVIDERS,
  type TrackingProvider,
} from "@masar/domain";
import { getDb } from "../../db";

export type ProviderStatus = "enabled" | "disabled" | "notConfigured" | "missingSecret";

export interface ProviderCard {
  readonly provider: TrackingProvider;
  readonly status: ProviderStatus;
  readonly view: IntegrationView | null;
}

/** حالة المنصة كما يراها المالك: لم تُضبط، متوقفة، مفعّلة، أو مفعّلة وينقصها المفتاح الخادمي. */
export function statusOf(provider: TrackingProvider, view: IntegrationView | null): ProviderStatus {
  if (view === null || !isCompleteConfig(provider, view.config)) {
    return "notConfigured";
  }
  if (!view.enabled) {
    return "disabled";
  }
  return isServerProvider(provider) && view.secretLast4 === null ? "missingSecret" : "enabled";
}

const LOG_LIMIT = 50;

export interface IntegrationsHub {
  readonly cards: readonly ProviderCard[];
  readonly events: readonly TrackingEventRow[];
  /** GTM مع GA4 أو Google Ads مباشرةً: الوسم نفسه داخل الحاوية يضاعف القياس (§8). */
  readonly gtmOverlap: boolean;
}

export async function loadIntegrationsHub(clubId: string): Promise<IntegrationsHub> {
  const [views, events] = await Promise.all([
    listIntegrations(getDb(), clubId),
    listRecentTrackingEvents(getDb(), clubId, LOG_LIMIT),
  ]);
  const byProvider = new Map(views.map((view) => [view.provider, view]));
  const cards = TRACKING_PROVIDERS.map((provider) => {
    const view = byProvider.get(provider) ?? null;
    return { provider, view, status: statusOf(provider, view) };
  });
  const enabled = (provider: TrackingProvider) => byProvider.get(provider)?.enabled === true;
  return {
    cards,
    events,
    gtmOverlap: enabled("gtm") && (enabled("ga4") || enabled("google_ads")),
  };
}

export async function loadProviderView(
  clubId: string,
  provider: TrackingProvider,
): Promise<{ readonly card: ProviderCard; readonly events: readonly TrackingEventRow[] }> {
  const hub = await loadIntegrationsHub(clubId);
  const card = hub.cards.find((item) => item.provider === provider) ?? {
    provider,
    view: null,
    status: "notConfigured" as const,
  };
  return { card, events: hub.events.filter((event) => event.provider === provider) };
}
