import type { MetadataRoute } from "next";
import { ADMIN_PATH } from "@/config/admin";
import { getEnv } from "@/server/env";

// الأصل من الإعداد عند الطلب: البناء نفسه يُنشر على أكثر من نطاق
export const dynamic = "force-dynamic";

/**
 * لا نحجب الزحف هنا حتى على النطاق المؤقت: منع الفهرسة يتم بترويسة X-Robots-Tag من proxy.ts،
 * ومحرك البحث يجب أن يستطيع قراءة الصفحة ليرى noindex. الواجهات لا تُزحف في كل الأحوال.
 * لا حجب لزواحف البحث بالذكاء الاصطناعي ولا لوكلاء المستخدمين: قاعدة واحدة للجميع (docs/BLOG.md).
 * لوحة التحكم ممنوعة الزحف حين تكون مفتوحة (ومعها ترويسة noindex من proxy.ts). وهي مغلقة لا تُذكر:
 * سطر المنع نفسه كان سيعلن وجودها.
 */
export default function robots(): MetadataRoute.Robots {
  const env = getEnv();
  const adminOpen = env.ADMIN_SECRET_KEY !== null;
  return {
    rules: { userAgent: "*", allow: "/", disallow: adminOpen ? ["/api/", ADMIN_PATH] : "/api/" },
    sitemap: `${env.SITE_URL}/sitemap.xml`,
  };
}
