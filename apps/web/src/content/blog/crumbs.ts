import { articlePath, ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";

export interface Crumb {
  readonly name: string;
  /** مسار في الموقع بلا لغة */
  readonly path: string;
}

/**
 * مسار التنقل لصفحة مقال: الرئيسية ← المدونة ← المقال. مصدر واحد للمسار الظاهر في الصفحة
 * (ArticleTrail) ولـBreadcrumbList في البيانات المنظَّمة، فلا يختلفان.
 */
export function articleCrumbs(dictionary: Dictionary, title: string, slug: string): Crumb[] {
  return [
    { name: dictionary.nav.home, path: ROUTES.home },
    { name: dictionary.blog.title, path: ROUTES.blog },
    { name: title, path: articlePath(slug) },
  ];
}
