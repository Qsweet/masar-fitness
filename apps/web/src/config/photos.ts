import type { StaticImageData } from "next/image";
import coachFloor from "@/assets/photos/coach-floor.jpg";
import coachRest from "@/assets/photos/coach-rest.jpg";
import consultation from "@/assets/photos/consultation.jpg";
import functionalPress from "@/assets/photos/functional-press.jpg";
import functionalSquat from "@/assets/photos/functional-squat.jpg";
import latPulldown from "@/assets/photos/lat-pulldown.jpg";
import legPress from "@/assets/photos/leg-press.jpg";
import logoWall from "@/assets/photos/logo-wall.jpg";
import pool from "@/assets/photos/pool.jpg";
import trainerPortrait from "@/assets/photos/trainer-portrait.jpg";
import type { Dictionary } from "@/i18n/dictionaries";

/** صورة الواجهة ملف عام بجانب الفيديو (config/media.ts)، وبقية الصور مستوردة هنا. */
export type PhotoKey = Exclude<keyof Dictionary["photos"], "heroPoster">;

/**
 * صور احترافية حقيقية من داخل النادي أرسلها المالك (2026-11-25)، بنسخ ويب بلا بيانات EXIF.
 * لا صورة مخزون ولا صورة مولَّدة. النص البديل لكل صورة في القاموس (dictionary.photos).
 * لا أسماء ولا أدوار لمن في الصور غير ما يظهر فيها. صورة الغرفة الخشبية الساخنة غير مستعملة:
 * المالك لم يؤكد وجود ساونا.
 */
export const PHOTOS: Readonly<Record<PhotoKey, StaticImageData>> = {
  legPress,
  functionalSquat,
  pool,
  functionalPress,
  coachFloor,
  latPulldown,
  coachRest,
  trainerPortrait,
  consultation,
  logoWall,
};
