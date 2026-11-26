/**
 * نصوص أوامر الخادم. بالعربية مع مفتاح إنجليزي قصير، لأن بعض طرفيات الخوادم لا تعرض العربية
 * متصلة الحروف. لا نص هنا يظهر لعميل.
 */
export const MESSAGES = {
  askClub: "معرّف النادي (club slug): ",
  clubChoices: "الأندية المتاحة (clubs):",
  unknownClub: "لا نادٍ بهذا المعرّف. (unknown club)",
  noClub: "لا نادٍ في القاعدة بعد: شغّل الترحيلات وبيانات النادي أولًا. (no club in database)",
  askEmail: "البريد الإلكتروني (email): ",
  askName: "الاسم الظاهر في اللوحة (display name): ",
  askPassword: "كلمة المرور، 12 حرفًا على الأقل، لا تظهر أثناء الكتابة (password): ",
  askPasswordAgain: "أعد كتابة كلمة المرور (repeat password): ",
  passwordMismatch: "الكلمتان غير متطابقتين. (passwords do not match)",
  invalidInput: "إدخال غير صالح. (invalid input)",
  tooManyAttempts: "محاولات كثيرة. أُلغي الأمر دون أي تغيير. (too many attempts, nothing changed)",
  ownerExists:
    "يوجد مالك نشط لهذا النادي. يضيف المالك بقية الموظفين من اللوحة. (an active owner already exists)",
  ownerCreated:
    "أُنشئ حساب المالك. ادخل من /admin/login وسجّل التحقق بخطوتين عند أول دخول. (owner created)",
  ownerNotFound: "لا مالك نشط بهذا البريد. (no active owner with this email)",
  confirmReset: "اكتب RESET لتأكيد إعادة ضبط التحقق بخطوتين (type RESET to confirm): ",
  cancelled: "أُلغي الأمر دون أي تغيير. (cancelled, nothing changed)",
  mfaReset:
    "أُعيد ضبط التحقق بخطوتين وأُلغيت جلسات المالك. يسجّله من جديد عند دخوله التالي. (2FA reset)",
  passwordReset: "غُيّرت كلمة مرور المالك وأُلغيت جلساته. (password changed)",
  notInteractive:
    "هذا الأمر تفاعلي: شغّله من طرفية حقيقية (docker compose exec app …)، لا من سكربت. (TTY required)",
  reasons: {
    "staff.email_invalid": "بريد غير صالح. (invalid email)",
    "staff.email_taken": "هذا البريد مستعمل لحساب آخر. (email already used)",
    "staff.name_invalid": "الاسم من حرفين إلى 80 حرفًا. (name must be 2-80 characters)",
    "staff.owner_exists": "يوجد مالك نشط لهذا النادي. (an active owner already exists)",
    "staff.password_too_short": "كلمة المرور أقصر من 12 حرفًا. (password too short)",
    "staff.password_too_long": "كلمة المرور أطول من 128 حرفًا. (password too long)",
    "staff.password_common": "كلمة مرور شائعة أو متكررة؛ اختر غيرها. (password too common)",
    "staff.password_contains_identity":
      "كلمة المرور تحوي البريد أو اسم النادي؛ اختر غيرها. (password contains email or club name)",
  } as Readonly<Record<string, string>>,
} as const;
