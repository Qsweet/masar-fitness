import { getPublishedArticles } from "@/server/blog";
import { getEnv } from "@/server/env";
import { getPublishedContent } from "@/server/content/site-content";
import { buildLlmsTxt } from "@/server/llms";

export const dynamic = "force-dynamic";

/** ‎/llms.txt‎: نص عادي بحقائق النادي وروابط الصفحات والمقالات المنشورة. المنشور دائمًا، بلا معاينة. */
export async function GET(): Promise<Response> {
  const [ar, en] = await Promise.all([getPublishedContent("ar"), getPublishedContent("en")]);
  const dictionaries = { ar: ar.dictionary, en: en.dictionary };
  return new Response(buildLlmsTxt(getEnv().SITE_URL, getPublishedArticles(), dictionaries), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
