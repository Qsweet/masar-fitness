import { liveSlides, type SliderState } from "@masar/domain";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { Carousel } from "./carousel";
import { SlideItem } from "./slide-item";
import styles from "./slider.module.css";

interface HomeSliderProps {
  readonly slider: SliderState;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
  readonly now: Date;
}

/**
 * الشريط تحت الواجهة (docs/ADMIN_A3_SLIDER.md §10): الشرائح السارية الآن بترتيبها من الإصدار المنشور
 * (أو المعاينة). لا شريحة سارية ⇒ لا قسم إطلاقًا. الواجهة تبقى عنصر LCP: لا صورة هنا بأولوية.
 */
export function HomeSlider({ slider, locale, dictionary, now }: HomeSliderProps) {
  const slides = liveSlides(slider.slides, now);
  if (slides.length === 0) {
    return null;
  }
  const labels = dictionary.slider;
  return (
    <section
      id="slides"
      className={styles.band}
      aria-roledescription="carousel"
      aria-labelledby="slides-title"
    >
      <h2 id="slides-title" className="sr-only">
        {labels.label}
      </h2>
      <div className="container">
        <Carousel
          count={slides.length}
          autoplay={slider.settings.autoplay}
          intervalMs={slider.settings.intervalMs}
          labels={labels}
        >
          {slides.map((slide, index) => (
            <SlideItem
              key={slide.id}
              slide={slide}
              index={index}
              total={slides.length}
              locale={locale}
              labels={labels}
            />
          ))}
        </Carousel>
      </div>
    </section>
  );
}
