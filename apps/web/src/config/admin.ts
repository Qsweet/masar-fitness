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
} as const;

export function staffMemberPath(id: string): string {
  return `${ADMIN_ROUTES.staff}/${id}`;
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
/** اسم مُصدر الرمز كما يظهر في تطبيق التحقق. */
export const TOTP_ISSUER = "Masters Way";
