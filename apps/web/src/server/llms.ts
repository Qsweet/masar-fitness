import { CLUB_CONTACT } from "@/config/club";
import { articlePath, ROUTES } from "@/config/routes";
import type { Article } from "@/content/blog/types";
import { articlesInLocale, isPublished } from "@/content/blog/visibility";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALES, localizedPath, type Locale } from "@/i18n/locales";

/** سطر رابط بصيغة llms.txt: ‎- [الاسم](الرابط): وصف‎ */
function link(name: string, url: string, note?: string): string {
  return `- [${name}](${url})${note === undefined ? "" : `: ${note}`}`;
}

function localeSection(
  origin: string,
  locale: Locale,
  published: readonly Article[],
  depth: string,
) {
  const dictionary = getDictionary(locale);
  const url = (path: string) => `${origin}${localizedPath(locale, path)}`;
  const articles = articlesInLocale(published, locale);
  return [
    `- ${CLUB_CONTACT.address[locale]}`,
    `- ${CLUB_CONTACT.phoneE164}`,
    "",
    `${depth} ${dictionary.footer.pages}`,
    "",
    link(dictionary.nav.home, url(ROUTES.home)),
    link(dictionary.nav.memberships, url(ROUTES.memberships)),
    link(dictionary.tools.footerLink, url(ROUTES.costPerVisit)),
    ...(articles.length === 0
      ? []
      : [
          "",
          `${depth} ${dictionary.blog.title}`,
          "",
          ...articles.map((article) =>
            link(
              article.translation.title,
              url(articlePath(article.slug)),
              article.translation.description,
            ),
          ),
        ]),
  ];
}

/**
 * llms.txt: نظافة رخيصة لا أكثر (docs/BLOG.md). حقائق النادي من الإعداد والقاموس، وروابط
 * الصفحات والمقالات المنشورة فقط. العربية أولًا ثم كل لغة أخرى تحت عنوانها.
 */
export function buildLlmsTxt(origin: string, articles: readonly Article[]): string {
  const published = articles.filter(isPublished);
  const main = getDictionary(DEFAULT_LOCALE);
  const others = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
  return [
    `# ${main.club.name}`,
    "",
    `> ${main.meta.homeDescription}`,
    "",
    ...localeSection(origin, DEFAULT_LOCALE, published, "##"),
    ...others.flatMap((locale) => {
      const dictionary = getDictionary(locale);
      return [
        "",
        `## ${dictionary.club.name}`,
        "",
        dictionary.meta.homeDescription,
        "",
        ...localeSection(origin, locale, published, "###"),
      ];
    }),
    "",
  ].join("\n");
}
