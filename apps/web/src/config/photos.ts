import type { StaticImageData } from "next/image";
import agilityFloor from "@/assets/photos/agility-floor.jpg";
import benchRow from "@/assets/photos/bench-row.jpg";
import coachFloor from "@/assets/photos/coach-floor.jpg";
import coachTalk from "@/assets/photos/coach-talk.jpg";
import consultation from "@/assets/photos/consultation.jpg";
import dumbbellRacks from "@/assets/photos/dumbbell-racks.jpg";
import functionalFront from "@/assets/photos/functional-front.jpg";
import functionalPress from "@/assets/photos/functional-press.jpg";
import functionalSquat from "@/assets/photos/functional-squat.jpg";
import functionalZone from "@/assets/photos/functional-zone.jpg";
import latPulldown from "@/assets/photos/lat-pulldown.jpg";
import legPress from "@/assets/photos/leg-press.jpg";
import machinesTurf from "@/assets/photos/machines-turf.jpg";
import pool from "@/assets/photos/pool.jpg";
import sauna from "@/assets/photos/sauna.jpg";
import trainerPortrait from "@/assets/photos/trainer-portrait.jpg";
import type { Dictionary } from "@/i18n/dictionaries";

export type PhotoKey = keyof Dictionary["photos"];

/**
 * صور احترافية حقيقية من داخل النادي أرسلها المالك (2026-11-25)، بنسخ ويب بلا بيانات EXIF.
 * لا صورة مخزون ولا صورة مولَّدة. النص البديل لكل صورة في القاموس (dictionary.photos).
 * لا أسماء ولا أدوار لمن في الصور غير ما يظهر فيها. صورة الساونا (حجارة ساخنة في غرفة خشبية) مستعملة
 * لأن موقع النادي الحالي يعرض الساونا مرفقًا مشمولًا (docs/CLUB_FACTS.md §3).
 * قصّات محفوظة في الملف نفسه (لا في CSS): المسبح بشعار الجدار كاملًا والماء، بلا بقية جدارية «BE STRONG» المقطوعة في الأصل،
 * وحديث المكتب على الجالس وحده بلا الكتف المموّه في المقدمة، والقرفصاء الأمامية بلا الساق المموّهة،
 * وصورة الواجهة (رفع البار فوق الرأس) على المدرب في وسطها بلا الظهر المموّه في طرفها.
 *
 * الصور الخمس الأخيرة (2026-11-25، الطلب الثالث للمالك) لقطات أماكن بإضاءة مسرحية وألوان معالجة بالأسود
 * والأصفر أرسلها المالك جاهزة: صف مقاعد البنش، والمنطقة الوظيفية، وأرضية الرشاقة، والأجهزة على العشب،
 * ورفوف الدمبلز. معالجة فنيًا، فلا نص يصفها بأنها بلا تعديل. تُستعمل للأماكن والخلفيات، وصور النادي
 * الحقيقية أعلاه حيث الحاجة إلى أشخاص ووجوه.
 *
 * تدريج الهوية (القرار 58، ffmpeg huesaturation): صور الأماكن الخمس والواجهة بأحمر وبرتقالي مطفأين وأخضر
 * وأزرق مخففين؛ وصور الحصص والمدربين الخمس بأحمر مطفأ فقط (قمصان). الأصفر لا يُمس، ولا تعديل في المحتوى.
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
  sauna,
  coachTalk,
  benchRow,
  functionalZone,
  agilityFloor,
  machinesTurf,
  dumbbellRacks,
};
