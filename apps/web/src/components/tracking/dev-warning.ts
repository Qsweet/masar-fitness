/**
 * تنبيه للمطوّر في وحدة تحكم المتصفح، في التطوير وحده: لا نص ظاهر للزائر، ولا شيء في الإنتاج. المكان
 * الوحيد في كود المتصفح المسموح له بالكتابة على console (كالسجل المنظَّم في الخادم).
 */
export function devWarning(message: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message);
  }
}
