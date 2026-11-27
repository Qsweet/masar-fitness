import { CONTENT_LOCALES, type ContentLocale } from "../locale";
import {
  MAX_SLIDES,
  SLIDE_ALT_LIMIT,
  SLIDE_TEXT_LIMITS,
  SLIDER_INTERVAL_MAX_MS,
  SLIDER_INTERVAL_MIN_MS,
  type SlideTextField,
} from "./limits";
import { isStoredLink, type SlideLink } from "./link";
import { isStoredText } from "./text";
import {
  CLICK_TARGETS,
  DEFAULT_SLIDER_SETTINGS,
  EMPTY_SLIDER,
  type Slide,
  type SlideImage,
  type SliderSettings,
  type SliderState,
  type SlideTexts,
} from "./types";
import { slideRuleIssues } from "./validate";

/**
 * قراءة الشريط من لقطة إصدار (ADMIN_A3_SLIDER §7، §9): كل شريحة تمر بالقواعد نفسها التي يمر بها الحفظ
 * (بلا فحص القائمة الداخلية: الفحص الكامل عند الحفظ والنشر). ما لا يصح يُسقط باسمه ولا يُرسم، فلقطة
 * تالفة أو قديمة لا تكسر الصفحة أبدًا.
 */
export interface ParsedSlider {
  readonly slider: SliderState;
  /** «slide:<معرّف>» أو «settings» أو «slides» لكل ما أُسقط. */
  readonly dropped: readonly string[];
}

type Json = Readonly<Record<string, unknown>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const COLOR = /^#[0-9a-f]{6}$/;
const BLUR_PREFIX = "data:image/webp;base64,";
const MAX_BLUR_LENGTH = 2_048;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** كل الحقول مقروءة (undefined = لا يصح؛ null قيمة مشروعة لما يقبل الغياب). */
type Present<T> = { readonly [K in keyof T]: Exclude<T[K], undefined> };

function allPresent<T extends object>(fields: T): fields is Present<T> & T {
  return Object.values(fields).every((value) => value !== undefined);
}

function matching(value: unknown, pattern: RegExp): string | undefined {
  return typeof value === "string" && pattern.test(value) ? value : undefined;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function flag(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function widthsOf(value: unknown): number[] | undefined {
  const widths = Array.isArray(value) ? value.map(positiveInt) : [];
  const ascending = widths.every(
    (width, index) => width !== undefined && (index === 0 || width > (widths[index - 1] ?? 0)),
  );
  return widths.length > 0 && ascending ? widths.filter((width) => width !== undefined) : undefined;
}

function blurOf(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.startsWith(BLUR_PREFIX) &&
    value.length <= MAX_BLUR_LENGTH
    ? value
    : undefined;
}

export function parseImage(value: unknown): SlideImage | undefined {
  const record = isRecord(value) ? value : {};
  const image = {
    id: matching(record.id, UUID),
    hash: matching(record.hash, HASH),
    width: positiveInt(record.width),
    height: positiveInt(record.height),
    widths: widthsOf(record.widths),
    blur: blurOf(record.blur),
    color: matching(record.color, COLOR),
  };
  return allPresent(image) ? image : undefined;
}

function textsOf(value: unknown, locale: ContentLocale): SlideTexts | undefined {
  const record = isRecord(value) ? value : {};
  const read = (field: SlideTextField) => {
    const text = record[field];
    return typeof text === "string" && isStoredText(text, locale, SLIDE_TEXT_LIMITS[field])
      ? text
      : undefined;
  };
  const texts = {
    eyebrow: read("eyebrow"),
    title: read("title"),
    subtitle: read("subtitle"),
    cta: read("cta"),
  };
  return allPresent(texts) ? texts : undefined;
}

function linkOf(value: unknown): SlideLink | undefined {
  const record = isRecord(value) ? value : {};
  const { kind, path, url, newTab } = record;
  let link: SlideLink | undefined;
  if (kind === "none") {
    link = { kind };
  } else if (kind === "internal" && typeof path === "string") {
    link = { kind, path };
  } else if (kind === "external" && typeof url === "string" && typeof newTab === "boolean") {
    link = { kind, url, newTab };
  }
  return link !== undefined && isStoredLink(link) ? link : undefined;
}

function dateOf(value: unknown): Date | null | undefined {
  if (value === null) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : undefined;
  return date !== undefined && !Number.isNaN(date.getTime()) && date.toISOString() === value
    ? date
    : undefined;
}

function localized<T>(
  value: unknown,
  read: (item: unknown, locale: ContentLocale) => T | undefined,
): Readonly<Record<ContentLocale, T>> | undefined {
  const record = isRecord(value) ? value : {};
  const both = { ar: read(record.ar, "ar"), en: read(record.en, "en") };
  return allPresent(both) ? both : undefined;
}

function altOf(value: unknown, locale: ContentLocale): string | undefined {
  return typeof value === "string" && isStoredText(value, locale, SLIDE_ALT_LIMIT)
    ? value
    : undefined;
}

function slideOf(value: unknown): Slide | undefined {
  const record = isRecord(value) ? value : {};
  const slide = {
    id: matching(record.id, UUID),
    desktop: parseImage(record.desktop),
    mobile: record.mobile === null ? null : parseImage(record.mobile),
    decorative: flag(record.decorative),
    alt: localized(record.alt, altOf),
    texts: localized(record.texts, textsOf),
    link: linkOf(record.link),
    clickTarget: CLICK_TARGETS.find((target) => target === record.clickTarget),
    active: flag(record.active),
    startsAt: dateOf(record.startsAt),
    endsAt: dateOf(record.endsAt),
  };
  return allPresent(slide) ? slide : undefined;
}

function isConsistent(slide: Slide): boolean {
  const altMatches = CONTENT_LOCALES.every(
    (locale) => (slide.alt[locale] === "") === slide.decorative,
  );
  const scheduleOrdered =
    slide.startsAt === null ||
    slide.endsAt === null ||
    slide.endsAt.getTime() > slide.startsAt.getTime();
  return altMatches && scheduleOrdered && slideRuleIssues(slide).length === 0;
}

function settingsOf(value: unknown): SliderSettings | undefined {
  const record = isRecord(value) ? value : {};
  const intervalMs = positiveInt(record.intervalMs);
  const inRange =
    intervalMs !== undefined &&
    intervalMs >= SLIDER_INTERVAL_MIN_MS &&
    intervalMs <= SLIDER_INTERVAL_MAX_MS;
  const settings = {
    autoplay: flag(record.autoplay),
    intervalMs: inRange ? intervalMs : undefined,
  };
  return allPresent(settings) ? settings : undefined;
}

function parseSlides(value: unknown, dropped: string[]): Slide[] {
  if (!Array.isArray(value)) {
    dropped.push("slides");
    return [];
  }
  const slides: Slide[] = [];
  for (const [index, item] of value.entries()) {
    const slide = slideOf(item);
    const duplicate = slide !== undefined && slides.some((other) => other.id === slide.id);
    if (slide === undefined || duplicate || !isConsistent(slide) || slides.length >= MAX_SLIDES) {
      dropped.push(`slide:${String(index)}`);
    } else {
      slides.push(slide);
    }
  }
  return slides;
}

/** الشريط من مفتاح `slider` في اللقطة؛ الغائب (إصدار قبل الشريط) شريط فارغ. */
export function parseSliderSnapshot(json: unknown): ParsedSlider {
  if (json === undefined) {
    return { slider: EMPTY_SLIDER, dropped: [] };
  }
  const record = isRecord(json) ? json : {};
  const dropped: string[] = [];
  const settings = settingsOf(record.settings);
  if (settings === undefined) {
    dropped.push("settings");
  }
  const slides = parseSlides(record.slides, dropped);
  return { slider: { settings: settings ?? DEFAULT_SLIDER_SETTINGS, slides }, dropped };
}
