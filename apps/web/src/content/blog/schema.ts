import { z } from "zod";
import { LOCALES } from "@/i18n/locales";
import { TOPIC_IDS } from "./topics";

/** حدود الشكل. الوصف 155 حرفًا حتى لا يُقص في نتائج البحث. */
export const DESCRIPTION_MAX = 155;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const EARLIEST_SOURCE_YEAR = 1900;
const LATEST_SOURCE_YEAR = 2100;

const text = z.string().trim().min(1);
const isoDate = z.iso.date();

/** رابط خارجي: https إلى نطاق حقيقي فقط (لا http ولا javascript: ولا عنوان IP). */
export const httpsUrl = z.url({ protocol: /^https$/u, hostname: z.regexes.domain });

/** رابط داخلي: مسار في الموقع يبدأ بشرطة واحدة، بلا بادئة لغة (تُضاف عند العرض). */
const internalPath = z
  .string()
  .regex(/^\/(?!\/)[^\s\\]*$/u, "internal link must be a site path like /memberships")
  .refine(
    (path) => !LOCALES.some((locale) => path === `/${locale}` || path.startsWith(`/${locale}/`)),
    "internal link must not carry a locale prefix",
  );

export function isInternalHref(href: string): boolean {
  return href.startsWith("/");
}

const segment = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), text }),
  z.strictObject({
    type: z.literal("link"),
    text,
    href: z.union([internalPath, httpsUrl]),
  }),
]);

const items = z.array(text).min(1);

const block = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("paragraph"), segments: z.array(segment).min(1) }),
  z.strictObject({ type: z.literal("list"), items }),
  z.strictObject({ type: z.literal("steps"), items }),
  z.strictObject({
    type: z.literal("table"),
    caption: text,
    head: z.array(text).min(2),
    rows: z.array(z.array(z.string().trim())).min(1),
  }),
  z.strictObject({ type: z.literal("note"), title: text, text }),
  z.strictObject({ type: z.literal("recommendation"), kind: z.literal("memberships") }),
]);

const section = z.strictObject({
  id: z.string().regex(SLUG_PATTERN, "section id: lowercase latin, digits and hyphens"),
  heading: text,
  blocks: z.array(block).min(1),
});

const source = z.strictObject({
  title: text,
  publisher: text,
  url: httpsUrl,
  year: z.int().min(EARLIEST_SOURCE_YEAR).max(LATEST_SOURCE_YEAR),
  accessed: isoDate,
});

const translation = z.strictObject({
  title: text,
  description: text.max(DESCRIPTION_MAX),
  summary: text.optional(),
  keyTakeaways: z.array(text),
  sections: z.array(section).min(1),
  sources: z.array(source),
});

/** شكل المقال، مسودة كانت أو منشورة. شروط النشر الإضافية في validate.ts. */
export const articleSchema = z.strictObject({
  slug: z.string().regex(SLUG_PATTERN, "slug: lowercase latin, digits and hyphens"),
  topic: z.enum(TOPIC_IDS),
  status: z.enum(["draft", "published"]),
  publishedAt: isoDate.optional(),
  updatedAt: isoDate,
  reviewedAt: isoDate.optional(),
  reviewerId: text.optional(),
  translations: z
    .strictObject({ ar: translation.optional(), en: translation.optional() })
    .refine((value) => LOCALES.some((locale) => value[locale] !== undefined), {
      error: "at least one translation",
    }),
});
