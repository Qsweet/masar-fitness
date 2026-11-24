/**
 * سياسة أمان المحتوى. السكربتات بـnonce لكل طلب (لذلك كل الصفحات تُعرض ديناميكيًا).
 * الأنماط: ملفات الموقع وما يحمل الـnonce؛ خاصية style على العناصر مسموحة
 * لأن next/image يكتبها، وهي لا تنفّذ كودًا (القرار 14 في docs/DECISIONS.md).
 * تُوسَّع القائمة صراحةً مع كل طرف ثالث يُضاف (الدفع، التحليلات، الخرائط).
 */
export function buildCsp(nonce: string, isDevelopment: boolean): string {
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
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}
