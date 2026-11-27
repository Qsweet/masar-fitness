import { overviewLaunchAr, overviewRangeAr } from "./overview-launch-ar";
import { orderStatusesAr } from "./statuses-ar";

/** نصوص «نظرة عامة» في اللوحة. جزء من قاموس اللوحة العربي (ar.ts)، مفصول لحجمه. */
export const overviewAr = {
  title: "نظرة عامة",
  /** {name}: اسم الموظف. */
  greeting: "أهلًا {name}",
  /** {date}: تاريخ اليوم بتقويم النادي. */
  today: "{date} · تقويم النادي",
  lead: {
    /** {range}: وصف الفترة («آخر 30 يومًا»). */
    data: "{range} حتى هذه اللحظة، مقارنةً بالفترة السابقة بالطول نفسه.",
    /** مدى مخصص انتهى قبل اليوم. */
    dataPast: "{range}، مقارنةً بالفترة السابقة بالطول نفسه.",
  },
  steps: { one: "خطوة واحدة", two: "خطوتان", few: "خطوات", many: "خطوة" },
  range: overviewRangeAr,
  kpis: {
    label: "مؤشرات الفترة",
    revenue: "الإيراد",
    paid: "الطلبات المدفوعة",
    completion: "نسبة إتمام الدفع",
    awaiting: "بانتظار الدفع الآن",
    awaitingHint: "طلبات مفتوحة لم تبلغ مهلتها",
    live: "لحظي",
    showAwaiting: "اعرضها",
    /** {value}: رقم الفترة السابقة. */
    against: "مقابل {value}",
    /** {value}: الفرق («15.3%» أو «2.3»). */
    up: "أعلى من الفترة السابقة بـ{value}",
    down: "أقل من الفترة السابقة بـ{value}",
    points: "{value} نقطة",
    startsWithFirstOrder: "يبدأ العدّ مع أول طلب من الموقع",
    noOrdersInRange: "لا طلبات في هذه الفترة",
  },
  chart: {
    title: { day: "الإيراد اليومي", week: "الإيراد الأسبوعي" },
    current: "هذه الفترة",
    previous: "الفترة السابقة",
    today: "اليوم",
    /** {amount}: مجموع الفترة. {previous}: مجموع السابقة. */
    summary: "مجموع الفترة {amount}، والسابقة {previous}",
    columns: { day: "اليوم", week: "الأسبوع من", revenue: "الإيراد", previous: "الفترة السابقة" },
    emptyTitle: "لا إيراد في هذه الفترة",
    emptyLead: "يظهر الرسم مع أول دفعة في الفترة المختارة.",
  },
  plans: {
    title: "المبيعات حسب الاشتراك",
    lead: "الطلبات المدفوعة في الفترة، بسطرها الأول",
    others: "غيرها",
    orders: { one: "طلب واحد", two: "طلبان", few: "طلبات", many: "طلبًا" },
    average: "متوسط قيمة الطلب",
    emptyTitle: "لا مبيعات مدفوعة في هذه الفترة",
  },
  funnel: {
    title: "من الطلب إلى الدفع",
    lead: "الطلبات المنشأة في الفترة ومحاولات دفعها",
    steps: { created: "أُنشئ طلب", attempted: "بدأ الدفع", paid: "دُفع" },
    /** {count}: الفاقد. {percent}: نسبته من الخطوة السابقة. */
    lostBefore: "فقد {count} ({percent}) قبل بدء الدفع",
    lostAfter: "فقد {count} ({percent})",
    /** {reasons}: أسباب الفقد بعد بدء الدفع («4 فشل الدفع و2 انتهت المهلة»). */
    lostAfterReasons: "فقد {count} ({percent}): {reasons}",
    reasons: {
      failed: "{count} فشل الدفع",
      expired: "{count} انتهت المهلة",
      other: "{count} مفتوحة أو ملغاة",
    },
    emptyTitle: "لا طلبات أُنشئت في هذه الفترة",
  },
  quick: { title: "إجراءات سريعة", lead: "أو ⌘K من أي صفحة" },
  launch: overviewLaunchAr,
  orders: {
    title: "آخر الطلبات",
    all: "كل الطلبات",
    columns: {
      reference: "المرجع",
      customer: "الجوال",
      item: "الباقة",
      total: "الإجمالي",
      status: "الحالة",
      time: "الوقت",
    },
    emptyTitle: "لا طلبات بعد",
    emptyLead: "تظهر الطلبات هنا فور إنشائها من صفحة الشراء.",
    phoneMask: "•••• ",
  },
  activity: {
    title: "آخر النشاط",
    all: "كل السجل",
    emptyTitle: "لا نشاط مسجَّل بعد",
    /** {actor}: الفاعل. {subject}: من وقع عليه الحدث. بصيغة المصدر: لا تفترض جنس الفاعل. */
    sentences: {
      login_succeeded: "دخول {actor} إلى اللوحة",
      login_failed: "محاولة دخول فاشلة: {subject}",
      account_locked: "قفل حساب {subject} بعد محاولات فاشلة",
      logout: "خروج {actor}",
      mfa_verified: "إتمام {actor} التحقق بخطوتين",
      mfa_failed: "رمز تحقق خاطئ لحساب {subject}",
      mfa_enrolled: "تفعيل {actor} التحقق بخطوتين",
      mfa_reset: "إعادة ضبط التحقق بخطوتين لـ{subject} بواسطة {actor}",
      recovery_code_used: "دخول {actor} برمز استرجاع",
      password_changed: "تغيير {actor} كلمة المرور",
      password_reset: "كلمة مرور مؤقتة لـ{subject} بواسطة {actor}",
      staff_created: "إنشاء حساب {subject} بواسطة {actor}",
      role_changed: "تغيير دور {subject} بواسطة {actor}",
      staff_disabled: "تعطيل حساب {subject} بواسطة {actor}",
      staff_enabled: "تفعيل حساب {subject} بواسطة {actor}",
      session_revoked: "إلغاء جلسة لـ{actor}",
    },
    /** لأحداث بلا قالب (أحداث البيع): {action} رمز الحدث. */
    fallback: "{action}: {subject} ({actor})",
  },
  system: {
    title: "حالة النظام",
    checkout: "الشراء الإلكتروني",
    checkoutStates: { open: "مفتوح", preview: "معاينة بلا دفع", closed: "مغلق" },
    payments: "الدفع",
    paymentsOff: "غير مربوط",
    /** {provider}: اسم المزوّد. */
    paymentsTest: "تجريبي ({provider})",
    indexing: "فهرسة محركات البحث",
    indexingStates: { on: "مفتوحة", off: "مغلقة" },
    version: "الإصدار",
    mfa: "التحقق بخطوتين",
    /** {enrolled} من {active} حسابًا نشطًا. */
    mfaCoverage: "{enrolled} من {active} حسابًا نشطًا",
  },
  orderStatuses: orderStatusesAr,
} as const;
