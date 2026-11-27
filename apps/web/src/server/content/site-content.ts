import "server-only";
import { applyTextOverrides, type TextOverrides } from "@masar/domain";
import { findRelease, latestRelease, oldestClubId } from "@masar/db";
import { cache } from "react";
import { defaultDictionary, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { getDb } from "../db";
import { logger } from "../logger";
import { textRegistry } from "./registry";
import { createPublishedReader } from "./resolver";

/**
 * مُحلِّل المحتوى العام الوحيد (ADMIN_A3_CONTENT §4): القاموس الافتراضي وفوقه تجاوزات الإصدار المنشور.
 * كل صفحة عامة و`generateMetadata` والتذييل وJSON-LD وllms.txt والخلاصة تقرأ منه، فالنص واحد في كل
 * مكان. `cache` من React: قراءة واحدة لكل طلب ولغة.
 */
export interface SiteContent {
  readonly dictionary: Dictionary;
  readonly releaseId: string | null;
  readonly mode: "published" | "preview" | "defaults";
}

const readPublished = createPublishedReader(
  {
    siteClubId: () => oldestClubId(getDb()),
    latestReleaseId: async (clubId) => (await latestRelease(getDb(), clubId))?.id ?? null,
    releaseSnapshot: async (clubId, releaseId) =>
      (await findRelease(getDb(), clubId, releaseId))?.snapshot ?? null,
  },
  textRegistry,
  logger,
);

/** القاموس المدموج لكل مجموعة تجاوزات ولغة، فلا يُعاد الدمج في كل طلب. */
const merged = new WeakMap<TextOverrides, Partial<Record<Locale, Dictionary>>>();

export function dictionaryWith(overrides: TextOverrides, locale: Locale): Dictionary {
  const base = defaultDictionary(locale);
  if (overrides.size === 0) {
    return base;
  }
  const byLocale = merged.get(overrides) ?? {};
  const dictionary = byLocale[locale] ?? applyTextOverrides(base, overrides, locale);
  merged.set(overrides, { ...byLocale, [locale]: dictionary });
  return dictionary;
}

/**
 * المنشور دائمًا، ولو حمل الطلب كوكي المعاينة: خريطة الموقع وllms.txt والخلاصة (لا تُعاين، ويقرؤها
 * الزاحف).
 */
export const getPublishedContent = cache(async (locale: Locale): Promise<SiteContent> => {
  const published = await readPublished();
  return {
    dictionary: dictionaryWith(published.overrides, locale),
    releaseId: published.releaseId,
    mode: published.mode,
  };
});

/** محتوى الصفحة العامة. */
export const getSiteContent = cache(
  (locale: Locale): Promise<SiteContent> => getPublishedContent(locale),
);
