import { getPublishedArticles } from "@/server/blog";
import { getEnv } from "@/server/env";
import { buildLlmsTxt } from "@/server/llms";

export const dynamic = "force-dynamic";

/** ‎/llms.txt‎: نص عادي بحقائق النادي وروابط الصفحات والمقالات المنشورة. */
export function GET(): Response {
  return new Response(buildLlmsTxt(getEnv().SITE_URL, getPublishedArticles()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
