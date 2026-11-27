import type { ContentLocale } from "../locale";
import type { SlideTextField } from "./limits";
import type { SlideLink } from "./link";
import { SLIDER_INTERVAL_DEFAULT_MS } from "./limits";

/**
 * أنواع الشريط (ADMIN_A3_SLIDER §2، §5). الصورة تُحمل بوصفها كاملًا (الأبعاد والنسخ والضباب واللون):
 * الأصل لا يتغير بعد إنشائه (C2)، فالوصف في اللقطة يكفي الموقع بلا استعلام لكل زائر.
 */
export interface SlideImage {
  readonly id: string;
  /** SHA-256 للبايتات الواردة بالست عشري: اسم مجلد النسخ ورابطها. */
  readonly hash: string;
  readonly width: number;
  readonly height: number;
  /** عروض النسخ المولَّدة تصاعديًا (AVIF وWebP لكلٍّ). */
  readonly widths: readonly number[];
  /** WebP صغير بـbase64 يُرسم ضبابًا قبل التحميل. */
  readonly blur: string;
  /** اللون الغالب (‎#rrggbb‎) خلفيةً قبل التحميل. */
  readonly color: string;
}

export type SlideTexts = Readonly<Record<SlideTextField, string>>;

export const CLICK_TARGETS = ["slide", "button"] as const;
export type ClickTarget = (typeof CLICK_TARGETS)[number];

export interface SlideContent {
  readonly desktop: SlideImage;
  readonly mobile: SlideImage | null;
  readonly decorative: boolean;
  /** النص البديل لكل لغة؛ فارغ للزخرفية. */
  readonly alt: Readonly<Record<ContentLocale, string>>;
  /** النصوص لكل لغة؛ الفارغ غائب. */
  readonly texts: Readonly<Record<ContentLocale, SlideTexts>>;
  readonly link: SlideLink;
  readonly clickTarget: ClickTarget;
  readonly active: boolean;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
}

export interface Slide extends SlideContent {
  readonly id: string;
}

export interface SliderSettings {
  readonly autoplay: boolean;
  readonly intervalMs: number;
}

export const DEFAULT_SLIDER_SETTINGS: SliderSettings = {
  autoplay: true,
  intervalMs: SLIDER_INTERVAL_DEFAULT_MS,
};

/** الشريط كله: إعداداته وشرائحه بترتيبها. */
export interface SliderState {
  readonly settings: SliderSettings;
  readonly slides: readonly Slide[];
}

export const EMPTY_SLIDER: SliderState = { settings: DEFAULT_SLIDER_SETTINGS, slides: [] };

export function isEmptySlider(slider: SliderState): boolean {
  const { settings } = slider;
  return (
    slider.slides.length === 0 &&
    settings.autoplay === DEFAULT_SLIDER_SETTINGS.autoplay &&
    settings.intervalMs === DEFAULT_SLIDER_SETTINGS.intervalMs
  );
}
