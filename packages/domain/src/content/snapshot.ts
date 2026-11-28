import { CONTENT_LOCALES, isContentLocale, type ContentLocale } from "./locale";
import { CONTENT_PATH_SHAPE } from "./paths";
import type { TextRegistry } from "./registry";
import { parseSliderSnapshot, type ParsedSlider } from "./slider/parse";
import { sliderJson, type SliderJson } from "./slider/serialize";
import type { SettingObject } from "./settings/spec";
import {
  NO_SETTINGS,
  parseSettings,
  settingsJson,
  type ParsedSettings,
  type SettingOverrides,
} from "./settings/state";
import { EMPTY_SLIDER, isEmptySlider, type SliderState } from "./slider/types";
import { structuralIssue } from "./text-override";

/**
 * لقطة إصدار المحتوى (ADMIN_A3_CONTENT §4.3): التجاوزات وحدها لا القاموس. عند القراءة يُسقط كل ما
 * لا يطابق السجل الحالي (مفتاح حذفه المطوّر، أو مُنع، أو تغيّرت عناصر افتراضيه، أو مفتاح غير معروف
 * في اللقطة)، فنشر كود لا يكسر الموقع بلقطة قديمة، ولا يُقرأ من اللقطة شيء غير النصوص. والتجاوز الذي
 * صار يساوي الافتراضي الحالي يُهمل بصمت: ليس تجاوزًا.
 */
export const SNAPSHOT_VERSION = 1;

export interface TextOverride {
  readonly value: string;
  /** بصمة الافتراضي وقت التعديل. */
  readonly baseHash: string;
}

export type LocaleOverrides = Readonly<Partial<Record<ContentLocale, TextOverride>>>;
/** المسار ← تجاوزه لكل لغة. */
export type TextOverrides = ReadonlyMap<string, LocaleOverrides>;

export interface Snapshot {
  readonly v: typeof SNAPSHOT_VERSION;
  readonly texts: Readonly<Record<string, LocaleOverrides>>;
  /** الشريط تحت الواجهة (ADMIN_A3_SLIDER §7)؛ غائب في إصدار بلا شريط. */
  readonly slider?: SliderJson;
  /** الإعدادات المنظَّمة (§5): تجاوزاتها وحدها؛ غائب في إصدار بلا تجاوز. */
  readonly settings?: Readonly<Record<string, SettingObject>>;
}

/** مفاتيح اللقطة المعروفة؛ ما سواها يُسقط ولا يُقرأ. */
const SNAPSHOT_KEYS: readonly string[] = ["v", "texts", "slider", "settings"];

export interface ParsedSnapshot {
  readonly texts: TextOverrides;
  /** «المسار [اللغة]» لكل ما أُسقط. */
  readonly dropped: readonly string[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function overrideOf(value: unknown): TextOverride | null {
  if (!isRecord(value) || typeof value.value !== "string" || typeof value.baseHash !== "string") {
    return null;
  }
  return { value: value.value, baseHash: value.baseHash };
}

function parseLocales(
  path: string,
  raw: unknown,
  registry: TextRegistry,
  dropped: string[],
): LocaleOverrides {
  const entry = registry.editable.get(path);
  const result: Partial<Record<ContentLocale, TextOverride>> = {};
  for (const [locale, value] of Object.entries(isRecord(raw) ? raw : {})) {
    const override = overrideOf(value);
    const valid =
      entry !== undefined &&
      isContentLocale(locale) &&
      override !== null &&
      structuralIssue(entry, locale, override.value) === null;
    if (valid && override.value === entry.defaults[locale]) {
      // تجاوز صار يساوي الافتراضي (نشر كود جعله الأصل): لا تجاوز، فلا يدخل البصمة ولا الفرق ولا التحقق
      continue;
    }
    if (valid) {
      result[locale] = override;
    } else {
      dropped.push(`${path} [${locale}]`);
    }
  }
  return result;
}

/** لقطة من JSON القاعدة، أو null لشكل أو إصدار مخطط غير معروف (يُعامل كأن لا إصدار). */
export function parseSnapshot(json: unknown, registry: TextRegistry): ParsedSnapshot | null {
  if (!isRecord(json) || json.v !== SNAPSHOT_VERSION || !isRecord(json.texts)) {
    return null;
  }
  const dropped: string[] = Object.keys(json)
    .filter((key) => !SNAPSHOT_KEYS.includes(key))
    .map((key) => `${key} [*]`);
  const texts = new Map<string, LocaleOverrides>();
  for (const [path, raw] of Object.entries(json.texts)) {
    const locales = CONTENT_PATH_SHAPE.test(path)
      ? parseLocales(path, raw, registry, dropped)
      : (dropped.push(`${path} [*]`), {});
    if (Object.keys(locales).length > 0) {
      texts.set(path, locales);
    }
  }
  return { texts, dropped };
}

/** الشريط في لقطة إصدار: شريط فارغ للقطة بلا شريط أو بشكل غير معروف. */
export function snapshotSlider(json: unknown): ParsedSlider {
  if (!isRecord(json) || json.v !== SNAPSHOT_VERSION) {
    return { slider: EMPTY_SLIDER, dropped: [] };
  }
  return parseSliderSnapshot(json.slider);
}

/** إعدادات لقطة إصدار: لا تجاوزات للقطة بلا إعدادات أو بشكل غير معروف. */
export function snapshotSettings(json: unknown): ParsedSettings {
  if (!isRecord(json) || json.v !== SNAPSHOT_VERSION) {
    return { settings: NO_SETTINGS, dropped: [] };
  }
  return parseSettings(json.settings);
}

/**
 * الشكل القانوني للتخزين والبصمة: المسارات مرتبة، واللغات بترتيبها الثابت، والشريط والإعدادات بشكلهما
 * القانوني حين لا يكونان فارغين (فبصمة مسودة بلا شريط ولا إعدادات كما كانت قبلهما).
 */
export function buildSnapshot(
  texts: TextOverrides,
  slider: SliderState = EMPTY_SLIDER,
  settings: SettingOverrides = NO_SETTINGS,
): Snapshot {
  const sorted = [...texts.entries()]
    .filter(([, locales]) => Object.keys(locales).length > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const snapshot: Snapshot = {
    v: SNAPSHOT_VERSION,
    texts: Object.fromEntries(
      sorted.map(([path, locales]) => [
        path,
        Object.fromEntries(
          CONTENT_LOCALES.flatMap((locale) => {
            const override = locales[locale];
            return override === undefined
              ? []
              : [[locale, { value: override.value, baseHash: override.baseHash }]];
          }),
        ),
      ]),
    ),
  };
  const withSlider = isEmptySlider(slider) ? snapshot : { ...snapshot, slider: sliderJson(slider) };
  return settings.size === 0 ? withSlider : { ...withSlider, settings: settingsJson(settings) };
}

/**
 * شكل اللقطة وحده بلا سجل (القاعدة تعيد لقطة إصدار إلى المسودة كما هي): نصوص وتجاوزات بقيمة وبصمة،
 * والإعدادات المنظَّمة بشكلها الحالي (الشريط يُعاد من جدوله).
 * null لغير ذلك. التحقق بالسجل الحالي يجري عند القراءة والنشر.
 */
export function snapshotShape(json: unknown): Snapshot | null {
  if (!isRecord(json) || json.v !== SNAPSHOT_VERSION || !isRecord(json.texts)) {
    return null;
  }
  const texts = new Map<string, LocaleOverrides>();
  for (const [path, raw] of Object.entries(json.texts)) {
    const locales: Partial<Record<ContentLocale, TextOverride>> = {};
    for (const [locale, value] of Object.entries(isRecord(raw) ? raw : {})) {
      const override = overrideOf(value);
      if (isContentLocale(locale) && override !== null) {
        locales[locale] = override;
      }
    }
    texts.set(path, locales);
  }
  return buildSnapshot(texts, EMPTY_SLIDER, parseSettings(json.settings).settings);
}
