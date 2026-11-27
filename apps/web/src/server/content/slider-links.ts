import "server-only";
import { ARTICLES } from "@/content/blog/articles";
import { isPublished } from "@/content/blog/visibility";
import { articlePath, planPath, ROUTES } from "@/config/routes";
import { getMembershipPlans } from "../catalog";

/**
 * وجهات الروابط الداخلية للشرائح (ADMIN_A3_SLIDER §3): الصفحات الثابتة، ومراسي الرئيسية المعروفة،
 * والباقات المعروضة الآن، والمقالات المنشورة. مسارات بلا لغة تُرسم بلغة الزائر. القائمة نفسها تبني
 * اختيار اللوحة وتتحقق عند الحفظ والنشر، فلا حقل حر ولا تحويل إلى صفحة غير موجودة.
 */
export const HOME_ANCHORS = [
  "plans",
  "facilities",
  "services",
  "about",
  "team",
  "hours",
  "contact",
  "water",
] as const;
export type HomeAnchor = (typeof HOME_ANCHORS)[number];
export type StaticPage = keyof typeof ROUTES;

export type LinkTarget =
  | { readonly kind: "page"; readonly path: string; readonly page: StaticPage }
  | { readonly kind: "anchor"; readonly path: string; readonly anchor: HomeAnchor }
  | { readonly kind: "plan" | "article"; readonly path: string; readonly name: string };

function staticTargets(): LinkTarget[] {
  const pages = Object.entries(ROUTES) as [StaticPage, string][];
  return [
    ...pages.map(([page, path]): LinkTarget => ({ kind: "page", path, page })),
    ...HOME_ANCHORS.map((anchor): LinkTarget => ({ kind: "anchor", path: `/#${anchor}`, anchor })),
  ];
}

/** كل الوجهات المعروفة الآن، بأسماء عربية للباقات والمقالات (اللوحة عربية). */
export async function slideLinkTargets(): Promise<LinkTarget[]> {
  const plans = await getMembershipPlans();
  const articles = ARTICLES.filter(isPublished).flatMap((article): LinkTarget[] => {
    const title = article.translations.ar?.title ?? article.translations.en?.title;
    return title === undefined
      ? []
      : [{ kind: "article", path: articlePath(article.slug), name: title }];
  });
  return [
    ...staticTargets(),
    ...plans.map(
      (plan): LinkTarget => ({ kind: "plan", path: planPath(plan.slug), name: plan.name.ar }),
    ),
    ...articles,
  ];
}

export async function knownSlidePaths(): Promise<ReadonlySet<string>> {
  return new Set((await slideLinkTargets()).map((target) => target.path));
}
