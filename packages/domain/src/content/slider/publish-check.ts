import { parseSliderSnapshot } from "./parse";
import { sliderJson } from "./serialize";
import type { SliderState } from "./types";

/**
 * الشرائح التي لا تُنشر (ADMIN_A3_SLIDER §3، §7): ما لا يمر بقراءة اللقطة نفسها (نص أو رابط أو قاعدة
 * مترابطة لا تصح بقواعد اليوم)، أو رابطه الداخلي لم يعد معروفًا (باقة أُوقفت، مقال سُحب). أي واحدة
 * ترفض النشر كله، فلا يُنشر رابط مكسور ولا يسقط من الموقع ما رآه الناشر في المعاينة.
 */
export function unpublishableSlides(
  slider: SliderState,
  knownPaths: ReadonlySet<string>,
): string[] {
  const parsed = parseSliderSnapshot(sliderJson(slider));
  const readable = new Set(parsed.slider.slides.map((slide) => slide.id));
  return slider.slides
    .filter(
      (slide) =>
        !readable.has(slide.id) ||
        (slide.link.kind === "internal" && !knownPaths.has(slide.link.path)),
    )
    .map((slide) => slide.id);
}
