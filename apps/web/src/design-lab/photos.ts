import type { StaticImageData } from "next/image";
import benches from "./assets/gym-benches.jpg";
import curlMachine from "./assets/gym-curl-machine.jpg";
import dumbbell from "./assets/gym-dumbbell.jpg";
import functional from "./assets/gym-functional.jpg";
import ropes from "./assets/gym-ropes.jpg";
import poolMural from "./assets/pool-mural.jpg";
import poolSurface from "./assets/pool-surface.jpg";
import poolWall from "./assets/pool-wall.jpg";

export interface LabPhoto {
  readonly src: StaticImageData;
  readonly alt: string;
}

/**
 * صور حقيقية من داخل النادي أرسلها المالك (2026-11-25). الأصول محفوظة في docs/design-lab/originals،
 * وهذه نسخ الويب (حواف لقطات الشاشة مقصوصة). لا صورة مخزون ولا صورة مولَّدة.
 */
export const PHOTOS = {
  benches: {
    src: benches,
    alt: "ممر أجهزة البنش في صالة الحديد، والجدار الأصفر مكتوب عليه «أنت قدها»",
  },
  curlMachine: { src: curlMachine, alt: "متدرب على جهاز تمرين الذراع في صالة الحديد" },
  dumbbell: { src: dumbbell, alt: "متدرب يرفع الدمبل أمام جدار «BE STRONG»" },
  ropes: { src: ropes, alt: "متدرب يتمرن بحبال القوة بجانب أكياس الملاكمة" },
  functional: {
    src: functional,
    alt: "مجموعة تتمرن في منطقة التمارين الوظيفية بالصناديق والأثقال",
  },
  poolMural: { src: poolMural, alt: "المسبح الداخلي وجدارية السبّاح «BE STRONG» منعكسة على الماء" },
  poolSurface: { src: poolSurface, alt: "سطح ماء المسبح من زاوية منخفضة وخطوط الحارات" },
  poolWall: { src: poolWall, alt: "حافة المسبح وشعار مسار الأبطال على الجدار" },
} as const satisfies Record<string, LabPhoto>;
