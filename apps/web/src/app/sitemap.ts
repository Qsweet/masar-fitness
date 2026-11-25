import type { MetadataRoute } from "next";
import { getPublishedArticles } from "@/server/blog";
import { getMembershipPlans } from "@/server/catalog";
import { getEnv } from "@/server/env";
import { sitemapEntries } from "@/server/sitemap-entries";

// الاشتراكات من القاعدة والأصل من الإعداد: تُقرأ عند الطلب لا عند البناء
export const dynamic = "force-dynamic";

/** خريطة الموقع: الروابط المعتمدة فقط، والمقالات المنشورة فقط (انظر sitemap-entries.ts). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const plans = await getMembershipPlans();
  return sitemapEntries({
    origin: getEnv().SITE_URL,
    planSlugs: plans.map((plan) => plan.slug),
    articles: getPublishedArticles(),
  });
}
