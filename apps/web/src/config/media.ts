/**
 * المقطع الصامت المتكرر: لقطة (9 ثوانٍ، 1280×720، H.264) من النادي، وإطاره صورةً قبل التشغيل.
 * الملفان في public/media ويُخدَّمان من الأصل نفسه (media-src يرث default-src 'self').
 * المقطع خلفية بصرية فقط في قسم «تمرّن بجد»: لا يُذكر في أي نص أن الحصص الجماعية ضمن الاشتراك
 * (غير مؤكد من المالك). كان في الواجهة، ونُقل لأن بطل الواجهة يحتاج وجهًا وجهدًا (القرار 48).
 */
export const CLASS_VIDEO = {
  src: "/media/group-class-loop.mp4",
  poster: "/media/group-class-poster.jpg",
  /**
   * عنصر نائب ضبابي للإطار (8×5 PNG) لأن الإطار ملف عام لا استيراد ثابت فلا يولّده Next.
   * يُعاد توليده إن تغيّر الإطار.
   */
  posterBlur:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAIAAAD38zoCAAAAiElEQVR42gF9AIL/AS4jIBgeIf36+u3t6w8JBPj2+TM0PvX48wRIQDUhHR/t7/L+/gcHKDYJ8+b23+0JLS0ECBEX+AcW9QD99P7/pt4PSe3D/evc69f/BAUYDfkJBNLO0DA8OX4YBfzbB+MsKhbp9wT3/Pnu69slKyQA7ukHAML5GwcfAAcKFCYj3TvOhSoBeAAAAABJRU5ErkJggg==",
} as const;
