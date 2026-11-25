import "server-only";
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, localizedPath, type Locale } from "@/i18n/locales";
import { getEnv } from "./env";

interface PageMetadataInput {
  readonly locale: Locale;
  /** مسار الصفحة بلا بادئة لغة. */
  readonly path: string;
  readonly title: string;
  readonly description: string;
  /** اللغات الموجودة فعلًا لهذه الصفحة (الافتراضي: كل اللغات). hreflang لا يذكر ترجمة غير موجودة. */
  readonly locales?: readonly Locale[];
  /** صفحة مقال: نوع OpenGraph «article» بتاريخي النشر والتعديل الحقيقيين. */
  readonly article?: { readonly publishedTime?: string; readonly modifiedTime: string };
  /** صفحة لا تُفهرس أبدًا (مسودة)، مهما كان إعداد الموقع. */
  readonly noindex?: boolean;
}

/**
 * بدائل اللغة المتبادلة: رابط لكل لغة موجودة، وx-default للعربية إن وُجدت وإلا لأول لغة موجودة.
 * كل صفحة من المجموعة تولّد القائمة نفسها، فالروابط متبادلة.
 */
export function alternateLanguages(
  origin: string,
  path: string,
  locales: readonly Locale[] = LOCALES,
): Record<string, string> {
  const urlFor = (target: Locale) => `${origin}${localizedPath(target, path)}`;
  const available = LOCALES.filter((target) => locales.includes(target));
  const fallback = available.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : available[0];
  return {
    ...Object.fromEntries(available.map((target) => [target, urlFor(target)])),
    ...(fallback === undefined ? {} : { "x-default": urlFor(fallback) }),
  };
}

/** البيانات الوصفية بأصل الموقع صريحًا (للاختبار). الصفحات تستعمل pageMetadata. */
export function buildPageMetadata(origin: string, input: PageMetadataInput): Metadata {
  const { locale, path, title, description, article, noindex = false } = input;
  const url = `${origin}${localizedPath(locale, path)}`;
  const openGraph: Metadata["openGraph"] =
    article === undefined
      ? { title, description, url, locale, type: "website" }
      : {
          title,
          description,
          url,
          locale,
          type: "article",
          modifiedTime: article.modifiedTime,
          ...(article.publishedTime === undefined ? {} : { publishedTime: article.publishedTime }),
        };
  return {
    title,
    description,
    alternates: { canonical: url, languages: alternateLanguages(origin, path, input.locales) },
    openGraph,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** عنوان ووصف ورابط معتمد وبدائل لغوية لكل صفحة: رابط واحد لكل لغة، والعربية هي الافتراضية. */
export function pageMetadata(input: PageMetadataInput): Metadata {
  return buildPageMetadata(getEnv().SITE_URL, input);
}
