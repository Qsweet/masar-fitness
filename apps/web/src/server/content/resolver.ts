import { parseSnapshot, type TextOverrides, type TextRegistry } from "@masar/domain";

/**
 * قراءة الإصدار المنشور (ADMIN_A3_CONTENT §4.1): استعلام صغير واحد لكل طلب (معرّف آخر إصدار)، واللقطة
 * المحلَّلة في ذاكرة العملية بمعرّفها (الإصدار لا يتغير بعد إدراجه، C1، فلا إبطال). القاعدة معطلة ⇒
 * آخر قراءة سليمة، وإلا الافتراضي؛ لا رمي أبدًا: الصفحة لا تسقط بسبب المحتوى.
 * بلا اعتماد على Next ولا القاعدة: المصدر يُحقن فيُختبر العطل والذاكرة وحدةً.
 */
export interface ContentSource {
  readonly siteClubId: () => Promise<string | null>;
  readonly latestReleaseId: (clubId: string) => Promise<string | null>;
  readonly releaseSnapshot: (clubId: string, releaseId: string) => Promise<unknown>;
}

export interface ContentLog {
  readonly error: (event: string, fields: Readonly<Record<string, unknown>>) => void;
  readonly warn: (event: string, fields: Readonly<Record<string, unknown>>) => void;
}

export interface PublishedTexts {
  readonly releaseId: string | null;
  readonly overrides: TextOverrides;
  /** `defaults`: تعذّرت القراءة ولا قراءة سليمة قبلها. */
  readonly mode: "published" | "defaults";
}

export const NO_OVERRIDES: TextOverrides = new Map();
const DEFAULTS: PublishedTexts = { releaseId: null, overrides: NO_OVERRIDES, mode: "defaults" };
/** أربع لقطات تكفي: المنشور الحالي وما قبله أثناء التبديل. */
const SNAPSHOT_CACHE_SIZE = 4;

/** اللقطة محلَّلة ومتحقَّقًا منها بالسجل الحالي، وما سقط منها في السجل لا في الصفحة. */
export function overridesOf(
  snapshot: unknown,
  registry: TextRegistry,
  log: ContentLog,
  releaseId: string,
) {
  const parsed = parseSnapshot(snapshot, registry);
  if (parsed === null) {
    log.error("content.snapshot_invalid", { releaseId });
    return NO_OVERRIDES;
  }
  if (parsed.dropped.length > 0) {
    log.warn("content.override_dropped", { releaseId, dropped: parsed.dropped });
  }
  return parsed.texts;
}

export function createPublishedReader(
  source: ContentSource,
  registry: () => TextRegistry,
  log: ContentLog,
): () => Promise<PublishedTexts> {
  const snapshots = new Map<string, TextOverrides>();
  let clubId: string | null = null;
  let lastGood: PublishedTexts | null = null;

  async function overridesFor(club: string, releaseId: string): Promise<TextOverrides> {
    const cached = snapshots.get(releaseId);
    if (cached !== undefined) {
      return cached;
    }
    const overrides = overridesOf(
      await source.releaseSnapshot(club, releaseId),
      registry(),
      log,
      releaseId,
    );
    snapshots.set(releaseId, overrides);
    const oldest = snapshots.keys().next();
    if (snapshots.size > SNAPSHOT_CACHE_SIZE && oldest.done !== true) {
      snapshots.delete(oldest.value);
    }
    return overrides;
  }

  return async () => {
    try {
      clubId ??= await source.siteClubId();
      if (clubId === null) {
        return DEFAULTS;
      }
      const releaseId = await source.latestReleaseId(clubId);
      const overrides = releaseId === null ? NO_OVERRIDES : await overridesFor(clubId, releaseId);
      lastGood = { releaseId, overrides, mode: "published" };
      return lastGood;
    } catch (error) {
      log.error("content.read_failed", { error });
      return lastGood ?? DEFAULTS;
    }
  };
}
