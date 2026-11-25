/** المحارف التي يقبلها XML 1.0: الجدولة والسطر الجديد والعودة، ثم ما بعد محارف التحكم عدا ‎U+FFFE/FFFF‎. */
const TAB = 0x9;
const LINE_FEED = 0xa;
const CARRIAGE_RETURN = 0xd;
const FIRST_PRINTABLE = 0x20;
const NON_CHARACTER_FFFE = 0xfffe;
const NON_CHARACTER_FFFF = 0xffff;

function isXmlChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  if (code < FIRST_PRINTABLE) {
    return code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN;
  }
  return code !== NON_CHARACTER_FFFE && code !== NON_CHARACTER_FFFF;
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** نص آمن داخل عنصر أو خاصية XML. */
export function escapeXml(text: string): string {
  // التقسيم بالمحرف (code point) مقصود: المطلوب فحص كل محرف على حدة لا تجميع الرموز المركبة
  return Array.from(text)
    .filter(isXmlChar)
    .join("")
    .replace(/[&<>"']/gu, (char) => XML_ENTITIES[char] ?? char);
}

export interface RssItem {
  readonly title: string;
  readonly url: string;
  readonly description: string;
  /** تاريخ النشر ISO (YYYY-MM-DD) */
  readonly publishedAt: string;
}

export interface RssChannel {
  readonly title: string;
  readonly url: string;
  /** رابط الخلاصة نفسها (atom:link rel=self) */
  readonly feedUrl: string;
  readonly description: string;
  readonly language: string;
  readonly items: readonly RssItem[];
}

/** تاريخ RFC 822 كما يطلبه RSS 2.0: ‎Sun, 01 Nov 2026 00:00:00 GMT‎ */
function rfc822(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toUTCString();
}

function itemXml(item: RssItem): string {
  return [
    "<item>",
    `<title>${escapeXml(item.title)}</title>`,
    `<link>${escapeXml(item.url)}</link>`,
    `<guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
    `<description>${escapeXml(item.description)}</description>`,
    `<pubDate>${rfc822(item.publishedAt)}</pubDate>`,
    "</item>",
  ].join("");
}

/** الأحدث نشرًا أولًا: ترتيب الخلاصة بتاريخ النشر لا بتاريخ التحديث (التحديث لا يعيد نشر المقال). */
function newestFirst(items: readonly RssItem[]): RssItem[] {
  return [...items].sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url),
  );
}

/** خلاصة RSS 2.0 كاملة، كل نص فيها مُهرَّب، وعناصرها الأحدث نشرًا أولًا. */
export function buildRss(channel: RssChannel): string {
  const items = newestFirst(channel.items);
  const latest = items[0]?.publishedAt;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(channel.title)}</title>`,
    `<link>${escapeXml(channel.url)}</link>`,
    `<atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeXml(channel.description)}</description>`,
    `<language>${escapeXml(channel.language)}</language>`,
    latest === undefined ? "" : `<lastBuildDate>${rfc822(latest)}</lastBuildDate>`,
    ...items.map(itemXml),
    "</channel>",
    "</rss>",
  ].join("\n");
}
