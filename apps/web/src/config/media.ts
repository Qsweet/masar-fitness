import type { StaticImageData } from "next/image";
import heroPoster from "@/assets/media/hero-poster.jpg";

/** مصدر فيديو بعرضه: المتصفح يختار أول مصدر يطابق استعلامه. */
export interface VideoSource {
  readonly src: string;
  /** استعلام الشاشة؛ غائب للمصدر الأخير الاحتياطي */
  readonly media?: string;
}

export interface ClubVideo {
  readonly poster: StaticImageData;
  /** من الأكبر إلى الأصغر */
  readonly sources: readonly VideoSource[];
  readonly type: string;
}

/**
 * مقطع الواجهة: لقطات حقيقية من حصة جماعية في النادي أرسلها المالك، مصحَّحة الألوان، صامتة، 12.7 ثانية
 * تتكرر. مدرَّجة بألوان الهوية (القرار 58): الأحمر والبرتقالي مطفآن (قمصان أندية وشعارات أطراف أخرى)،
 * والأخضر والأزرق مخففان، والأصفر كما هو. ثلاث نسخ بالعرض (1920 و1280 و854) في ‎public/media‎، والإطار الأول صورة ثابتة (عنصر LCP).
 */
export const HERO_VIDEO: ClubVideo = {
  poster: heroPoster,
  sources: [
    { src: "/media/hero-1920.mp4", media: "(min-width: 1440px)" },
    { src: "/media/hero-1280.mp4", media: "(min-width: 800px)" },
    { src: "/media/hero-854.mp4" },
  ],
  type: "video/mp4",
};
