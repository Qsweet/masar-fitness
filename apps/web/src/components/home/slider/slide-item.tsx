import type { Slide } from "@masar/domain";
import { buttonClass } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { MediaPicture } from "@/components/ui/media-picture";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./slider.module.css";

/** الهاتف تحت 48rem يأخذ صورة الهاتف بقصّها الأطول (اتجاه فني). */
const MOBILE_QUERY = "(max-width: 47.99rem)";
const SIZES = "(min-width: 80rem) 80rem, 100vw";

interface SlideItemProps {
  readonly slide: Slide;
  readonly index: number;
  readonly total: number;
  readonly locale: Locale;
  readonly labels: Dictionary["slider"];
}

function linkProps(slide: Slide, locale: Locale) {
  const { link } = slide;
  if (link.kind === "internal") {
    return { href: localizedPath(locale, link.path) };
  }
  if (link.kind === "external") {
    return {
      href: link.url,
      rel: "noopener noreferrer",
      ...(link.newTab ? { target: "_blank" } : {}),
    };
  }
  return null;
}

/**
 * رابط الشريحة: الزر وحده، أو الشريحة كلها (رابط واحد يغطيها بـ`::after`، واسمه الزر أو العنوان أو النص
 * البديل). الخارجي بـ`noopener noreferrer`، والجديد اللسان بنص لقارئ الشاشة.
 */
function SlideAction({ slide, locale, labels }: Omit<SlideItemProps, "index" | "total">) {
  const props = linkProps(slide, locale);
  if (props === null) {
    return null;
  }
  const { cta, title } = slide.texts[locale];
  const whole = slide.clickTarget === "slide";
  const newTab =
    slide.link.kind === "external" && slide.link.newTab ? (
      <span className="sr-only"> {labels.newTab}</span>
    ) : null;
  return (
    <a
      {...props}
      className={cx(cta !== "" && buttonClass("primary"), whole && styles.stretched)}
      draggable={false}
    >
      {cta === "" ? (
        <span className="sr-only">{title || slide.alt[locale]}</span>
      ) : (
        <>
          {cta}
          <Icon name="arrow" />
        </>
      )}
      {newTab}
    </a>
  );
}

/** شريحة واحدة بمجموعتها (APG): الصورة بنسخها، والتدرّج، والنصوص بلغة الزائر، والرابط. */
export function SlideItem({ slide, index, total, locale, labels }: SlideItemProps) {
  const texts = slide.texts[locale];
  const hasText = texts.eyebrow !== "" || texts.title !== "" || texts.subtitle !== "";
  return (
    <div
      className={styles.slide}
      data-slide={index}
      role="group"
      aria-roledescription="slide"
      aria-label={fill(labels.slide, { n: String(index + 1), total: String(total) })}
    >
      <MediaPicture
        image={slide.desktop}
        mobile={slide.mobile}
        mobileQuery={MOBILE_QUERY}
        sizes={SIZES}
        alt={slide.alt[locale]}
        loading={index === 0 ? "eager" : "lazy"}
        className={styles.image}
      />
      <div className={cx(styles.scrim, hasText && styles.scrimText)} aria-hidden="true" />
      <div className={styles.content}>
        {texts.eyebrow === "" ? null : <p className={styles.eyebrow}>{texts.eyebrow}</p>}
        {texts.title === "" ? null : <h3 className={styles.title}>{texts.title}</h3>}
        {texts.subtitle === "" ? null : <p className={styles.subtitle}>{texts.subtitle}</p>}
        <SlideAction slide={slide} locale={locale} labels={labels} />
      </div>
    </div>
  );
}
