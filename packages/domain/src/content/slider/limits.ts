/**
 * حدود شريط الشرائح (ADMIN_A3_SLIDER §2، §5). ثوابت تقنية لا قرار عمل: تمنع نصًا يكسر التخطيط فوق
 * الصورة، وفاصل تشغيل لا يُقرأ فيه النص، وصورة تتشوه بالتكبير.
 */
export const SLIDE_TEXT_FIELDS = ["eyebrow", "title", "subtitle", "cta"] as const;
export type SlideTextField = (typeof SLIDE_TEXT_FIELDS)[number];

/** الحد الأقصى بنقاط الترميز بعد التطبيع: السطر الصغير، والعنوان، والسطر الشارح، وتسمية الزر. */
export const SLIDE_TEXT_LIMITS: Readonly<Record<SlideTextField, number>> = {
  eyebrow: 40,
  title: 70,
  subtitle: 160,
  cta: 30,
};

export const SLIDE_ALT_LIMIT = 250;
/** أقصى شرائح في المسودة: أكثر من ذلك لا يراه زائر ويثقل الصفحة. */
export const MAX_SLIDES = 8;
export const EXTERNAL_URL_MAX_LENGTH = 500;

export const SLIDER_INTERVAL_MIN_MS = 4_000;
export const SLIDER_INTERVAL_MAX_MS = 15_000;
export const SLIDER_INTERVAL_DEFAULT_MS = 7_000;

/** أدنى عرض لصورة الحاسوب ولصورة الهاتف بالبكسل: أصغر منهما يظهر مكبَّرًا مشوشًا. */
export const DESKTOP_IMAGE_MIN_WIDTH = 1280;
export const MOBILE_IMAGE_MIN_WIDTH = 640;

/** عروض النسخ المولَّدة لكل صورة (AVIF وWebP لكلٍّ)، من الهاتف إلى شاشة عالية الكثافة. */
const VARIANT_WIDTH = { phone: 640, tablet: 960, laptop: 1280, desktop: 1920, retina: 2560 };
export const IMAGE_VARIANT_WIDTHS: readonly number[] = Object.values(VARIANT_WIDTH);
