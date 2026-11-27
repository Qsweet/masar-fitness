/**
 * ثوابت لوحة التحكم (docs/ADMIN_DESIGN.md §4). بلا اعتماد على الخادم: يقرؤها الوسيط (proxy.ts) أيضًا.
 * حدود المحاولات حماية تقنية؛ قفل الحساب نفسه في المجال (`lockout.ts`) ويُحفظ في القاعدة.
 */
export const ADMIN_PATH = "/admin";

export const ADMIN_ROUTES = {
  home: ADMIN_PATH,
  login: `${ADMIN_PATH}/login`,
  verify: `${ADMIN_PATH}/verify`,
  enrol: `${ADMIN_PATH}/enrol`,
  recoveryCodes: `${ADMIN_PATH}/recovery-codes`,
  password: `${ADMIN_PATH}/password`,
  staff: `${ADMIN_PATH}/staff`,
  staffNew: `${ADMIN_PATH}/staff/new`,
  audit: `${ADMIN_PATH}/audit`,
  account: `${ADMIN_PATH}/account`,
  sales: `${ADMIN_PATH}/sales`,
  orders: `${ADMIN_PATH}/sales/orders`,
  customers: `${ADMIN_PATH}/sales/customers`,
  plans: `${ADMIN_PATH}/sales/plans`,
  plansNew: `${ADMIN_PATH}/sales/plans/new`,
  promotions: `${ADMIN_PATH}/sales/promotions`,
  promotionsNew: `${ADMIN_PATH}/sales/promotions/new`,
  salesSettings: `${ADMIN_PATH}/sales/settings`,
  content: `${ADMIN_PATH}/content`,
  contentTexts: `${ADMIN_PATH}/content/texts`,
} as const;

export function staffMemberPath(id: string): string {
  return `${ADMIN_ROUTES.staff}/${id}`;
}

export function orderPath(id: string): string {
  return `${ADMIN_ROUTES.orders}/${id}`;
}

export function orderCancelPath(id: string): string {
  return `${orderPath(id)}/cancel`;
}

export function orderSettlePath(id: string): string {
  return `${orderPath(id)}/settle`;
}

export function customerPath(id: string): string {
  return `${ADMIN_ROUTES.customers}/${id}`;
}

export function planPath(id: string): string {
  return `${ADMIN_ROUTES.plans}/${id}`;
}

/** صفحة تأكيد تغيير حالة منتج؛ الإجراء في `?to=`. */
export function planStatusPath(id: string): string {
  return `${planPath(id)}/status`;
}

export function promotionPath(id: string): string {
  return `${ADMIN_ROUTES.promotions}/${id}`;
}

/** صفحة تأكيد تغيير حالة عرض؛ الإجراء في `?to=`. */
export function promotionStatusPath(id: string): string {
  return `${promotionPath(id)}/status`;
}

/** نصوص مساحة واحدة من القاموس (‎/admin/content/texts/hero‎). */
export function contentNamespacePath(namespace: string): string {
  return `${ADMIN_ROUTES.contentTexts}/${namespace}`;
}

/** هل المسار داخل اللوحة؟ ‎/admin‎ نفسه وكل ما تحته، لا ‎/administrator‎. */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}

/**
 * هل ضُبط مفتاح اللوحة في البيئة؟ فحص وجود فقط للوسيط؛ صحة المفتاح (32 بايتًا base64) يفرضها
 * الإقلاع في `parse-env.ts`، فمفتاح فاسد لا يصل إلى هنا أصلًا.
 */
export function isAdminConfigured(rawKey: string | undefined): boolean {
  return rawKey !== undefined && rawKey !== "";
}

/**
 * ترويسة طلب داخلية يضعها الوسيط على مسارات اللوحة المفتوحة فقط (ويحذف ما يرسله العميل بها).
 * قاعدة next.config تعيد كتابة كل ‎/admin‎ بلاها إلى اللغة الافتراضية، أي إلى 404 العامة.
 */
export const ADMIN_OPEN_HEADER = "x-masar-admin-open";
export const ADMIN_OPEN_VALUE = "1";

const HEX = 16;

/** حرف واحد كما قد يُكتب في رابط: نفسه، أو مرمَّزًا بالنسبة المئوية بحالتيه (‎a‎ أو ‎%61‎ أو ‎%41‎). */
function anySpelling(letter: string): string {
  const codes = [letter.toLowerCase(), letter.toUpperCase()].map(
    (form) => `%${form.charCodeAt(0).toString(HEX)}`,
  );
  return `(?:${[letter, ...codes].join("|")})`;
}

/**
 * نمط المقطع الأول «admin» بكل كتابة يفكّها الخادم إليه: أي حالة حروف (مطابقة القواعد بلا حساسية)
 * وأي حرف مرمَّز. قاعدة next.config تطابق الرابط الخام، وملفات المسارات تُطابَق بعد فك الترميز، فبلا
 * هذا النمط يصل ‎/%61dmin‎ إلى ملفات اللوحة متجاوزًا القاعدة.
 */
export const ADMIN_SEGMENT_PATTERN = Array.from(ADMIN_PATH.slice(1), anySpelling).join("");

/** ردود اللوحة لا تُخزَّن في أي ذاكرة وسيطة. */
export const NO_STORE_HEADER = { name: "Cache-Control", value: "no-store" } as const;

/** اسم كوكي الجلسة: البادئة ‎__Host-‎ تفرض Secure و Path=/ وبلا Domain، ولا تُقبل إلا على https. */
export const ADMIN_COOKIE_SECURE = "__Host-masar_admin";
/** على عنوان الجهاز بـhttp (التطوير واختبار البناء): المتصفح يرفض البادئة بلا https. */
export const ADMIN_COOKIE_LOCAL = "masar_admin";

const MINUTE_MS = 60_000;
const THROTTLE_WINDOW_MINUTES = 10;
export const ADMIN_THROTTLE_WINDOW_MS = THROTTLE_WINDOW_MINUTES * MINUTE_MS;
/** محاولات الدخول من عنوان واحد في النافذة (مكتب النادي كله خلف عنوان واحد). */
export const MAX_LOGIN_ATTEMPTS_PER_IP = 30;
/** محاولات الدخول لبريد واحد في النافذة، من أي عنوان. */
export const MAX_LOGIN_ATTEMPTS_PER_EMAIL = 10;
/** محاولات رموز الخطوة الثانية والاسترجاع لحساب واحد في النافذة (مستقل عن حد الدخول). */
export const MAX_MFA_ATTEMPTS_PER_STAFF = 10;
/** محاولات رموز الخطوة الثانية والاسترجاع من عنوان واحد في النافذة. */
export const MAX_MFA_ATTEMPTS_PER_IP = 30;
/** محاولات كتابة «كلمة المرور الحالية» في «حسابي» لحساب واحد في النافذة. */
export const MAX_CURRENT_PASSWORD_CHECKS_PER_STAFF = 5;
/** بحث بجوال كامل لموظف واحد في النافذة (ADMIN_A2_SALES §6.3): حد تقني يمنع تعداد الأرقام. */
export const MAX_PHONE_LOOKUPS_PER_STAFF = 20;
/** كشف جوال كامل لموظف واحد في النافذة (سؤال المالك 1: ثلاثون في عشر دقائق). */
export const MAX_PHONE_REVEALS_PER_STAFF = 30;
/** محاولات تسجيل دفع يدوي لموظف واحد في النافذة، ناجحة أو مرفوضة. */
export const MAX_MANUAL_SETTLE_ATTEMPTS_PER_STAFF = 10;
export const MAX_ADMIN_THROTTLE_KEYS = 5_000;

/** لا يُحدَّث «آخر نشاط» للجلسة أكثر من مرة في هذه المدة: كتابة واحدة في الدقيقة تكفي لحد الخمول. */
export const SESSION_TOUCH_INTERVAL_MS = MINUTE_MS;

/** أقصى طول يُقبل لحقول النماذج قبل أي معالجة (يرفض الإدخال الضخم قبل التجزئة). */
export const MAX_EMAIL_INPUT_LENGTH = 254;
export const MAX_PASSWORD_INPUT_LENGTH = 512;
export const MAX_CODE_INPUT_LENGTH = 32;
export const MAX_NAME_INPUT_LENGTH = 120;

/** منطقة عرض الأوقات حين لا يُقرأ النادي (لا يحدث لموظف له نادٍ؛ بديل آمن لا خطأ). */
export const FALLBACK_TIMEZONE = "UTC";
/** عدد صفوف سجل التدقيق في الصفحة. */
export const AUDIT_PAGE_SIZE = 25;
/** عدد صفوف قائمة الطلبات في الصفحة، ومداها الزمني الافتراضي بالأيام (اليوم مشمول). */
export const ORDERS_PAGE_SIZE = 25;
export const ORDERS_DEFAULT_RANGE_DAYS = 30;
/** طلبات العميل المعروضة في صفحته (الأحدث أولًا). */
export const CUSTOMER_ORDERS_SHOWN = 50;
/** أقصى نتائج بحث النصوص في الصفحة الواحدة، وأقصى طول لعبارة البحث. */
export const CONTENT_SEARCH_RESULTS = 100;
export const CONTENT_SEARCH_MAX_LENGTH = 80;
/** أقصى طول خام لحقل نص محتوى قبل أي معالجة: أربعة أضعاف أطول نوع (700). */
export const MAX_CONTENT_TEXT_INPUT = 2_800;
/** عمر رمز تأكيد الدفع اليدوي المختوم بالدقائق. */
export const SETTLE_TOKEN_MINUTES = 10;
/** اسم مُصدر الرمز كما يظهر في تطبيق التحقق. */
export const TOTP_ISSUER = "Masters Way";

/** كوكي مظهر اللوحة (داكن افتراضيًا): يقرؤه التخطيط الجذري على الخادم، فلا وميض عند التحميل. */
export const ADMIN_THEME_COOKIE = "masar_admin_theme";
export const ADMIN_THEMES = ["dark", "light"] as const;
export type AdminTheme = (typeof ADMIN_THEMES)[number];
export const DEFAULT_ADMIN_THEME: AdminTheme = "dark";

export function parseAdminTheme(value: string | undefined): AdminTheme {
  return ADMIN_THEMES.find((theme) => theme === value) ?? DEFAULT_ADMIN_THEME;
}

/**
 * كوكي طيّ الشريط الجانبي: يكتبه المتصفح عند الضغط ويقرؤه الخادم عند العرض، فيخرج الشريط بحالته
 * من أول بايت. تفضيل عرض لا سر: ليس HttpOnly.
 */
export const ADMIN_NAV_COOKIE = "masar_admin_nav";
export const ADMIN_NAV_COLLAPSED = "collapsed";
export const ADMIN_NAV_EXPANDED = "expanded";
const DAYS_PER_YEAR = 365;
const SECONDS_PER_DAY = 86_400;
/** عمر كوكيَي التفضيل بالثواني. */
export const ADMIN_PREFERENCE_MAX_AGE = DAYS_PER_YEAR * SECONDS_PER_DAY;

/** أيام الرسم البياني في «نظرة عامة»، وأيام الخط الصغير في بطاقات الأرقام. */
export const OVERVIEW_CHART_DAYS = 14;
export const OVERVIEW_SPARK_DAYS = 7;
export const OVERVIEW_RECENT_ORDERS = 8;
export const OVERVIEW_ACTIVITY_ROWS = 8;
