import { CONTENT_LOCALES } from "../locale";
import { SLIDE_TEXT_FIELDS } from "./limits";
import type { SlideLink } from "./link";
import type { Slide, SlideImage, SliderState, SlideTexts } from "./types";

/**
 * الشكل القانوني للشريط في لقطة الإصدار (ADMIN_A3_SLIDER §7): المفاتيح بترتيب ثابت، والشرائح بترتيب
 * عرضها، والأوقات بصيغة ISO. البصمة تُحسب على هذا الشكل، فترتيب كتابة الحقول لا يغيّرها.
 */
export interface SlideImageJson {
  readonly id: string;
  readonly hash: string;
  readonly width: number;
  readonly height: number;
  readonly widths: readonly number[];
  readonly blur: string;
  readonly color: string;
}

export interface SlideJson {
  readonly id: string;
  readonly desktop: SlideImageJson;
  readonly mobile: SlideImageJson | null;
  readonly decorative: boolean;
  readonly alt: Readonly<Record<string, string>>;
  readonly texts: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly link: SlideLink;
  readonly clickTarget: string;
  readonly active: boolean;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

export interface SliderJson {
  readonly settings: { readonly autoplay: boolean; readonly intervalMs: number };
  readonly slides: readonly SlideJson[];
}

function imageJson(image: SlideImage): SlideImageJson {
  return {
    id: image.id,
    hash: image.hash,
    width: image.width,
    height: image.height,
    widths: [...image.widths],
    blur: image.blur,
    color: image.color,
  };
}

function textsJson(texts: SlideTexts): Record<string, string> {
  return Object.fromEntries(SLIDE_TEXT_FIELDS.map((field) => [field, texts[field]]));
}

function linkJson(link: SlideLink): SlideLink {
  switch (link.kind) {
    case "none":
      return { kind: "none" };
    case "internal":
      return { kind: "internal", path: link.path };
    case "external":
      return { kind: "external", url: link.url, newTab: link.newTab };
  }
}

export function slideJson(slide: Slide): SlideJson {
  return {
    id: slide.id,
    desktop: imageJson(slide.desktop),
    mobile: slide.mobile === null ? null : imageJson(slide.mobile),
    decorative: slide.decorative,
    alt: Object.fromEntries(CONTENT_LOCALES.map((locale) => [locale, slide.alt[locale]])),
    texts: Object.fromEntries(
      CONTENT_LOCALES.map((locale) => [locale, textsJson(slide.texts[locale])]),
    ),
    link: linkJson(slide.link),
    clickTarget: slide.clickTarget,
    active: slide.active,
    startsAt: slide.startsAt?.toISOString() ?? null,
    endsAt: slide.endsAt?.toISOString() ?? null,
  };
}

export function sliderJson(slider: SliderState): SliderJson {
  return {
    settings: { autoplay: slider.settings.autoplay, intervalMs: slider.settings.intervalMs },
    slides: slider.slides.map(slideJson),
  };
}

/** معرّفات الأصول التي يستعملها الشريط (للحماية من الحذف بـ`content_release_media`). */
export function sliderAssetIds(slider: SliderState): string[] {
  const ids = slider.slides.flatMap((slide) =>
    slide.mobile === null ? [slide.desktop.id] : [slide.desktop.id, slide.mobile.id],
  );
  return [...new Set(ids)].sort();
}
