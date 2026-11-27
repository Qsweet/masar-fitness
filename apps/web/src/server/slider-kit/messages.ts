/**
 * نصوص أمر الخادم `pnpm slider:launch-kit` (docs/SLIDER_KIT.md §3). بالعربية مع مفتاح إنجليزي قصير،
 * كأوامر المالك الأخرى، لأن بعض طرفيات الخوادم لا تعرض العربية متصلة. لا نص هنا يظهر لزائر.
 */
export const KIT_MESSAGES = {
  uploadsOff:
    "رفع الصور غير مفعّل في هذا الخادم: اكتب MEDIA_UPLOADS=yes في deploy/.env ثم update.sh --force (docs/DEPLOYMENT.md). لم يتغير شيء. (MEDIA_UPLOADS is not enabled)",
  noClub: "لا نادٍ في القاعدة بعد: شغّل الترحيلات أولًا. لم يتغير شيء. (no club in database)",
  noOwner:
    "لا مالك نشط للنادي: أنشئه أولًا بـ pnpm admin:create-owner. لم يتغير شيء. (no active owner)",
  imageMissing: "صورة من صور العدّة غير موجودة في الصورة المبنية: {file}. (kit image missing)",
  imageRefused: "رفض خط الصور صورة العدّة {file}: {reason}. (kit image refused)",
  slideInvalid: "شريحة العدّة {id} لم تمر بالتحقق: {fields}. (kit slide invalid)",
  slideRefused: "رُفض إنشاء شريحة العدّة {id}: {reason}. (kit slide refused)",
  created: "أُضيفت إلى المسودة: {id}. (added to draft)",
  skipped: "موجودة من قبل، لم تُكرر: {id}. (already there, skipped)",
  done: "تمّ. الشرائح في المسودة ولم تُنشر: عاينها من «المحتوى ← شريط الشرائح ← عاين المسودة» ثم انشر من «المحتوى ← النشر». (done, nothing published)",
} as const;

export type KitMessage = keyof typeof KIT_MESSAGES;

/** يملأ {name} في نص الرسالة. */
export function kitMessage(key: KitMessage, values: Readonly<Record<string, string>> = {}): string {
  return KIT_MESSAGES[key].replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
