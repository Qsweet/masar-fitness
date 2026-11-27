import {
  EMPTY_SLIDER,
  parseSnapshot,
  snapshotSlider,
  type SliderState,
  type TextOverrides,
  type TextRegistry,
} from "@masar/domain";

/**
 * قراءة الإصدار المنشور (ADMIN_A3_CONTENT §4.1): استعلام صغير واحد لكل طلب (معرّف آخر إصدار)، واللقطة
 * المحلَّلة في ذاكرة العملية بمعرّفها (الإصدار لا يتغير بعد إدراجه، C1، فلا إبطال). القاعدة معطلة ⇒
 * آخر قراءة سليمة، وإلا الافتراضي؛ لا رمي أبدًا: الصفحة لا تسقط بسبب المحتوى. الشريط تحت الواجهة
 * (ADMIN_A3_SLIDER §9) من اللقطة نفسها: لا استعلام إضافي للزائر، وشريط تالف أو غائب = لا شريط.
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

/** ما يُقرأ من لقطة: التجاوزات والشريط. */
export interface PublishedContent {
  readonly overrides: TextOverrides;
  readonly slider: SliderState;
}

export interface PublishedTexts extends PublishedContent {
  readonly releaseId: string | null;
  /** `defaults`: تعذّرت القراءة ولا قراءة سليمة قبلها. */
  readonly mode: "published" | "defaults";
}

export const NO_OVERRIDES: TextOverrides = new Map();
const NOTHING: PublishedContent = { overrides: NO_OVERRIDES, slider: EMPTY_SLIDER };
const DEFAULTS: PublishedTexts = { releaseId: null, ...NOTHING, mode: "defaults" };
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

/** شريط اللقطة، وما سقط منه في السجل لا في الصفحة. */
export function sliderOf(snapshot: unknown, log: ContentLog, releaseId: string): SliderState {
  const parsed = snapshotSlider(snapshot);
  if (parsed.dropped.length > 0) {
    log.warn("content.slider_dropped", { releaseId, dropped: parsed.dropped });
  }
  return parsed.slider;
}

export function createPublishedReader(
  source: ContentSource,
  registry: () => TextRegistry,
  log: ContentLog,
): () => Promise<PublishedTexts> {
  const snapshots = new Map<string, PublishedContent>();
  let clubId: string | null = null;
  let lastGood: PublishedTexts | null = null;

  async function contentFor(club: string, releaseId: string): Promise<PublishedContent> {
    const cached = snapshots.get(releaseId);
    if (cached !== undefined) {
      return cached;
    }
    const snapshot = await source.releaseSnapshot(club, releaseId);
    const overrides = {
      overrides: overridesOf(snapshot, registry(), log, releaseId),
      slider: sliderOf(snapshot, log, releaseId),
    };
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
      const content = releaseId === null ? NOTHING : await contentFor(clubId, releaseId);
      lastGood = { releaseId, ...content, mode: "published" };
      return lastGood;
    } catch (error) {
      log.error("content.read_failed", { error });
      return lastGood ?? DEFAULTS;
    }
  };
}
