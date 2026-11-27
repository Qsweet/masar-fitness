import type { ContentPermission, TextRule } from "@masar/domain";
import type { ContentPrefix } from "./paths";

/**
 * قائمة السماح لنصوص الموقع (ADMIN_A3_CONTENT §3.2). أطول بادئة مطابقة تحكم، وما لا تطابقه بادئة
 * ممنوع. سبب المنع رمز يترجمه قاموس اللوحة، فمتصفح المفاتيح يعرض الممنوع قراءةً بسببه. لا سعر ولا
 * مبلغ ولا شرط بيع في مسموح (يفحصه اختبار السجل).
 */
type Rule =
  | { readonly prefix: ContentPrefix; readonly permission: ContentPermission }
  | { readonly prefix: ContentPrefix; readonly locked: LockReason };

export const LOCK_REASONS = [
  "commerce",
  "grammar",
  "navigation",
  "system",
  "blog",
  "accessibility",
  "format",
  "offerTerms",
  "claim",
  "terms",
  "brand",
  "media",
  "whatsapp",
  "catalogTable",
] as const;
export type LockReason = (typeof LOCK_REASONS)[number];

const write = (prefix: ContentPrefix): Rule => ({ prefix, permission: "content.write" });
const facts = (prefix: ContentPrefix): Rule => ({ prefix, permission: "content.facts" });
const lock = (prefix: ContentPrefix, locked: LockReason): Rule => ({ prefix, locked });

/** مساحات ممنوعة كليًا: نصوص الشراء والدفع والشروط، والتنسيق، والتنقل، وصفحات النظام، والمدونة (A4). */
const FORBIDDEN: readonly Rule[] = [
  ...(["currency", "plans", "plan", "payment", "onlinePayment", "checkout", "cart"] as const).map(
    (prefix) => lock(prefix, "commerce"),
  ),
  ...(["steps", "daily", "dailyNote"] as const).map((prefix) => lock(prefix, "commerce")),
  lock("months", "grammar"),
  lock("days", "grammar"),
  ...(["nav", "tabs", "quickBar"] as const).map((prefix) => lock(prefix, "navigation")),
  lock("location", "whatsapp"),
  ...(["staging", "notFound", "error"] as const).map((prefix) => lock(prefix, "system")),
  lock("blog", "blog"),
  lock("photos", "media"),
  // الشريط تحت الواجهة: تسميات وصول؛ محتواه من صفحة الشريط لا من متصفح النصوص (ADMIN_A3_SLIDER §11)
  lock("slider", "accessibility"),
];

const HERO: readonly Rule[] = [
  lock("hero", "accessibility"),
  ...(
    [
      "hero.place",
      "hero.title",
      "hero.slogan",
      "hero.lead",
      "hero.action",
      "hero.watch",
      "hero.scroll",
      "hero.offerWith",
      "hero.videoTitle",
      "hero.videoNote",
    ] as const
  ).map(write),
];

const SECTIONS: readonly Rule[] = [
  ...(["highlights", "goals", "facilities", "about", "team", "stats", "reviews"] as const).map(
    write,
  ),
  lock("reviews.stars", "accessibility"),
  lock("services", "format"),
  ...(
    [
      "services.eyebrow",
      "services.title",
      "services.lead",
      "services.items",
      "services.ask",
    ] as const
  ).map(write),
  lock("services.whatsappMessage", "whatsapp"),
  lock("friends", "offerTerms"),
  ...(["friends.eyebrow", "friends.title", "friends.action"] as const).map(write),
  lock("friends.whatsappMessage", "whatsapp"),
  lock("hours", "format"),
  ...(
    [
      "hours.eyebrow",
      "hours.title",
      "hours.lead",
      "hours.club",
      "hours.pool",
      "hours.poolNote",
      "hours.holidayNote",
    ] as const
  ).map(write),
  write("cta"),
  lock("cta.note", "terms"),
  write("contact"),
  lock("contact.privacy", "claim"),
  lock("contact.compose", "whatsapp"),
];

const PAGES: readonly Rule[] = [
  write("meta"),
  lock("memberships", "catalogTable"),
  write("memberships.title"),
  write("memberships.intro"),
  ...(
    [
      "tools.costPerVisit.metaTitle",
      "tools.costPerVisit.metaDescription",
      "tools.costPerVisit.title",
      "tools.costPerVisit.lead",
    ] as const
  ).map(write),
  lock("tools.costPerVisit.approximate", "claim"),
  lock("tools.costPerVisit.times", "format"),
  lock("tools.costPerVisit.resultTitle", "format"),
  write("footer.tagline"),
  lock("club", "brand"),
  ...(["club.name", "club.shortName", "club.slogan"] as const).map(facts),
];

export const TEXT_RULES: readonly TextRule[] = [...FORBIDDEN, ...HERO, ...SECTIONS, ...PAGES];
