import type { StaticImageData } from "next/image";
import coachFloor from "@/assets/photos/coach-floor.jpg";
import consultation from "@/assets/photos/consultation.jpg";
import functionalFront from "@/assets/photos/functional-front.jpg";
import functionalPress from "@/assets/photos/functional-press.jpg";
import functionalSquat from "@/assets/photos/functional-squat.jpg";
import latPulldown from "@/assets/photos/lat-pulldown.jpg";
import legPress from "@/assets/photos/leg-press.jpg";
import pool from "@/assets/photos/pool.jpg";
import trainerPortrait from "@/assets/photos/trainer-portrait.jpg";
import type { Dictionary } from "@/i18n/dictionaries";

/** إطار المقطع ملف عام بجانب الفيديو (config/media.ts)، وبقية الصور مستوردة هنا. */
export type PhotoKey = Exclude<keyof Dictionary["photos"], "videoPoster">;

/**
 * صور احترافية حقيقية من داخل النادي أرسلها المالك (2026-11-25)، بنسخ ويب بلا بيانات EXIF.
 * لا صورة مخزون ولا صورة مولَّدة. النص البديل لكل صورة في القاموس (dictionary.photos).
 * لا أسماء ولا أدوار لمن في الصور غير ما يظهر فيها. صورة الغرفة الخشبية الساخنة غير مستعملة:
 * المالك لم يؤكد وجود ساونا.
 * قصّات محفوظة في الملف نفسه (لا في CSS): المسبح بشعار الجدار كاملًا والماء، بلا بقية جدارية «BE STRONG» المقطوعة في الأصل،
 * وحديث المكتب على الجالس وحده بلا الكتف المموّه في المقدمة، والقرفصاء الأمامية بلا الساق المموّهة،
 * وصورة الواجهة (رفع البار فوق الرأس) على المدرب في وسطها بلا الظهر المموّه في طرفها.
 */
export const PHOTOS: Readonly<Record<PhotoKey, StaticImageData>> = {
  functionalPress,
  legPress,
  functionalSquat,
  pool,
  functionalFront,
  coachFloor,
  latPulldown,
  trainerPortrait,
  consultation,
};
