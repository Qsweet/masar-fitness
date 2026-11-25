/**
 * سياسة أمان المحتوى. السكربتات بـnonce لكل طلب (لذلك كل الصفحات تُعرض ديناميكيًا).
 * الأنماط: ملفات الموقع وما يحمل الـnonce؛ خاصية style على العناصر مسموحة
 * لأن next/image يكتبها، وهي لا تنفّذ كودًا (القرار 14 في docs/DECISIONS.md).
 * تُوسَّع القائمة صراحةً مع كل طرف ثالث يُضاف (الدفع، التحليلات، الخرائط).
 * `form-action` يبقى 'self' إلا مع Moyasar مضبوطًا وأصل صفحته المستضافة معلنًا في الإعداد: زر الدفع
 * نموذج POST يرد الخادم عليه بتحويل 303 إلى صفحة المزوّد، والمتصفح بلا JavaScript يطبّق `form-action`
 * على وجهة التحويل أيضًا.
 */
export function buildCsp(
  nonce: string,
  isDevelopment: boolean,
  formActionOrigins: readonly string[] = [],
): string {
  const directives = [
    "default-src 'self'",
    // React في وضع التطوير يحتاج eval لإعادة بناء مسارات الأخطاء؛ لا يُسمح به في الإنتاج
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    ["form-action 'self'", ...formActionOrigins].join(" "),
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/;

/**
 * الأصول الخارجية المسموحة لوجهة النماذج، من البيئة مباشرة (الوسيط لا يحمّل إعداد الخادم):
 * أصل صفحة Moyasar المستضافة، فقط مع `PAYMENTS_MODE=test` و`PAYMENTS_PROVIDER=moyasar` وأصل https
 * سليم الشكل في `MOYASAR_HOSTED_PAGE_ORIGIN`. غير ذلك قائمة فارغة، والقيمة نفسها يفحصها الإقلاع.
 */
export function paymentFormActionOrigins(
  env: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  const origin = env.MOYASAR_HOSTED_PAGE_ORIGIN ?? "";
  const moyasar = env.PAYMENTS_MODE === "test" && env.PAYMENTS_PROVIDER === "moyasar";
  return moyasar && HTTPS_ORIGIN.test(origin) ? [origin] : [];
}
