import { CLUB_CONTACT, CLUB_POSTAL_ADDRESS } from "@/config/club";
import { articlePath, ROUTES } from "@/config/routes";
import type { Article, ArticleTranslation, Reviewer } from "@/content/blog/types";
import { localizedPath, type Locale } from "@/i18n/locales";
import type { JsonObject } from "./json-ld";

/**
 * البيانات المنظَّمة (schema.org) تصف ما في الصفحة فقط، وتساعد الفهم لا الترتيب (docs/BLOG.md).
 * لا تقييمات ولا ساعات عمل ولا نطاق أسعار: لم يؤكدها المالك. لا FAQPage (أُلغيت نتائجها في 2026).
 */
const CONTEXT = "https://schema.org";

export interface SiteIdentity {
  readonly origin: string;
  readonly locale: Locale;
  readonly clubName: string;
  /** رابط مطلق لصورة الشعار */
  readonly logoUrl: string;
}

const ids = (origin: string) => ({
  organization: `${origin}/#organization`,
  gym: `${origin}/#gym`,
  website: `${origin}/#website`,
});

function absolute(identity: SiteIdentity, path: string): string {
  return `${identity.origin}${localizedPath(identity.locale, path)}`;
}

/** النادي جهةً: مؤلف المقالات وناشرها. المعرّف واحد في كل الصفحات فتندمج الأوصاف. */
export function organizationNode(identity: SiteIdentity): JsonObject {
  return {
    "@type": "Organization",
    "@id": ids(identity.origin).organization,
    name: identity.clubName,
    url: absolute(identity, ROUTES.home),
    logo: { "@type": "ImageObject", url: identity.logoUrl },
  };
}

/** الرئيسية: الجهة، والنادي مكانًا (ExerciseGym)، والموقع. حقائق مؤكدة من config/club.ts فقط. */
export function homeGraph(
  identity: SiteIdentity,
  page: { readonly description: string; readonly imageUrls: readonly string[] },
): JsonObject {
  const { locale } = identity;
  const id = ids(identity.origin);
  return {
    "@context": CONTEXT,
    "@graph": [
      organizationNode(identity),
      {
        "@type": "ExerciseGym",
        "@id": id.gym,
        name: identity.clubName,
        description: page.description,
        url: absolute(identity, ROUTES.home),
        telephone: CLUB_CONTACT.phoneE164,
        logo: identity.logoUrl,
        image: [...page.imageUrls],
        address: {
          "@type": "PostalAddress",
          streetAddress: CLUB_POSTAL_ADDRESS.street[locale],
          addressLocality: CLUB_POSTAL_ADDRESS.locality[locale],
          postalCode: CLUB_POSTAL_ADDRESS.postalCode,
          addressCountry: CLUB_POSTAL_ADDRESS.country,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: Number(CLUB_CONTACT.latitude),
          longitude: Number(CLUB_CONTACT.longitude),
        },
        parentOrganization: { "@id": id.organization },
      },
      {
        "@type": "WebSite",
        "@id": id.website,
        name: identity.clubName,
        url: absolute(identity, ROUTES.home),
        inLanguage: locale,
        publisher: { "@id": id.organization },
      },
    ],
  };
}

interface Crumb {
  readonly name: string;
  readonly path: string;
}

export function breadcrumbNode(identity: SiteIdentity, id: string, crumbs: readonly Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(identity, crumb.path),
    })),
  } satisfies JsonObject;
}

function citations(translation: ArticleTranslation): JsonObject[] {
  return translation.sources.map((source) => ({
    "@type": "CreativeWork",
    name: source.title,
    url: source.url,
    datePublished: String(source.year),
    publisher: { "@type": "Organization", name: source.publisher },
  }));
}

function blogPosting(
  identity: SiteIdentity,
  article: Article,
  translation: ArticleTranslation,
  pageId: string,
): JsonObject {
  const organization = organizationNode(identity);
  return {
    "@type": "BlogPosting",
    "@id": `${absolute(identity, articlePath(article.slug))}#article`,
    headline: translation.title,
    description: translation.description,
    ...(article.publishedAt === undefined ? {} : { datePublished: article.publishedAt }),
    dateModified: article.updatedAt,
    inLanguage: identity.locale,
    author: organization,
    publisher: organization,
    mainEntityOfPage: { "@id": pageId },
    citation: citations(translation),
  };
}

/** المراجعة تُعلن فقط لمقال منشور بمراجع مسجَّل وتاريخ مراجعة، كما تظهر في رأس الصفحة. */
function review(article: Article, reviewer: Reviewer | undefined, locale: Locale): JsonObject {
  if (
    article.status !== "published" ||
    reviewer === undefined ||
    article.reviewedAt === undefined
  ) {
    return {};
  }
  return {
    lastReviewed: article.reviewedAt,
    reviewedBy: {
      "@type": "Person",
      name: reviewer.name[locale],
      hasCredential: {
        "@type": "EducationalOccupationalCredential",
        name: reviewer.credential[locale],
      },
    },
  };
}

export interface ArticleGraphInput {
  readonly article: Article;
  readonly translation: ArticleTranslation;
  readonly reviewer: Reviewer | undefined;
  /** مسار التنقل الظاهر في الصفحة: الرئيسية ← المدونة ← المقال */
  readonly crumbs: readonly Crumb[];
}

/** صفحة المقال: WebPage كيانها الرئيسي BlogPosting، ومسار التنقل. */
export function articleGraph(identity: SiteIdentity, input: ArticleGraphInput): JsonObject {
  const { article, translation } = input;
  const url = absolute(identity, articlePath(article.slug));
  const pageId = `${url}#webpage`;
  const breadcrumbId = `${url}#breadcrumb`;
  return {
    "@context": CONTEXT,
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageId,
        url,
        name: translation.title,
        description: translation.description,
        inLanguage: identity.locale,
        isPartOf: { "@id": ids(identity.origin).website },
        breadcrumb: { "@id": breadcrumbId },
        ...review(article, input.reviewer, identity.locale),
        mainEntity: blogPosting(identity, article, translation, pageId),
      },
      breadcrumbNode(identity, breadcrumbId, input.crumbs),
    ],
  };
}
