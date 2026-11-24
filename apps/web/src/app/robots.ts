import type { MetadataRoute } from "next";

/**
 * لا نحجب الزحف هنا حتى على النطاق المؤقت: منع الفهرسة يتم بترويسة X-Robots-Tag من proxy.ts،
 * ومحرك البحث يجب أن يستطيع قراءة الصفحة ليرى noindex. الواجهات لا تُزحف في كل الأحوال.
 * خريطة الموقع تُضاف هنا مع أول صفحات قابلة للفهرسة (المرحلة 6).
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
