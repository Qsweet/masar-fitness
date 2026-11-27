/**
 * ثوابت مكتبة الوسائط (docs/ADMIN_A3_SLIDER.md §6). حدود تقنية لا قرارات عمل: تحمي الخادم من ملف ضخم
 * أو «قنبلة بكسلات»، وتبقي الصورة حادة على الشاشات الكبيرة. بلا اعتماد على الخادم: يقرؤها مكوّن الموقع.
 */
/** أقصى حجم للملف المرفوع: 8 MiB. */
export const MAX_UPLOAD_BYTES = 8_388_608;
/** هامش ترويسات النموذج متعدد الأجزاء فوق الملف نفسه. */
export const UPLOAD_FORM_OVERHEAD_BYTES = 65_536;
/** أقصى بكسلات الأصل (25 ميغابكسل، 6000×4000 تقريبًا) تُفحص من الترويسة قبل فك الترميز. */
export const MAX_INPUT_PIXELS = 25_000_000;
export const MIN_IMAGE_SIDE = 640;
export const MAX_IMAGE_SIDE = 8_000;
/** جودة الترميز: AVIF أصغر بجودة مرئية مماثلة لـWebP 80. جهد AVIF ‏2: الجهد 4 أبطأ بست مرات على خادم صغير (22 ثانية لصورة 2400 بكسل مقابل 3.6) بفرق حجم صغير (القرار 77). */
export const AVIF_QUALITY = 55;
export const AVIF_EFFORT = 2;
export const WEBP_QUALITY = 80;
/** عرض صورة الضباب قبل التحميل. */
export const BLUR_WIDTH = 16;
export const BLUR_QUALITY = 40;
export const MAX_ORIGINAL_NAME_LENGTH = 120;
/** رفعات الموظف في النافذة الثابتة (عشر دقائق، حدود اللوحة). */
export const MAX_UPLOADS_PER_STAFF = 20;

export const MEDIA_FORMATS = ["avif", "webp"] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

export const MEDIA_ROUTE = "/api/media";
/** اسم ملف النسخة في المجلد والرابط معًا. */
export function variantFileName(width: number, format: MediaFormat): string {
  return `w${String(width)}.${format}`;
}

/** رابط نسخة صورة: بصمة البايتات الواردة اسم المجلد، فالرابط لا يتغير محتواه أبدًا. */
export function mediaFileUrl(hash: string, width: number, format: MediaFormat): string {
  return `${MEDIA_ROUTE}/${hash}/${variantFileName(width, format)}`;
}

export const MEDIA_HASH_SHAPE = /^[0-9a-f]{64}$/;
export const MEDIA_FILE_SHAPE = /^w(\d{3,4})\.(avif|webp)$/;

/** صور المكتبة في الصفحة، وأقصى صور في منتقي الشريحة (الأحدث أولًا). */
export const MEDIA_PAGE_SIZE = 24;
export const MEDIA_PICKER_LIMIT = 120;
