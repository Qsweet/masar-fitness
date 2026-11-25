import Link from "next/link";
import { isInternalHref } from "@/content/blog/schema";
import type { Block, Segment } from "@/content/blog/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { MembershipRecommendation } from "./membership-recommendation";
import styles from "./article.module.css";

interface Context {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

function SegmentView({ segment, locale }: { readonly segment: Segment; readonly locale: Locale }) {
  if (segment.type === "text") {
    return segment.text;
  }
  if (isInternalHref(segment.href)) {
    return <Link href={localizedPath(locale, segment.href)}>{segment.text}</Link>;
  }
  return (
    <a href={segment.href} rel="noopener noreferrer">
      {segment.text}
    </a>
  );
}

function TableView({ block }: { readonly block: Extract<Block, { type: "table" }> }) {
  return (
    <div className={styles.tableScroller}>
      <table className={styles.table}>
        {block.caption === undefined ? null : <caption>{block.caption}</caption>}
        <thead>
          <tr>
            {block.head.map((cell, index) => (
              <th key={index} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={index}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** كتلة واحدة من جسم المقال. كلها تُعرض على الخادم: كل كلمة في HTML الصفحة. */
export function BlockView({ block, locale, dictionary }: { readonly block: Block } & Context) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className={styles.paragraph}>
          {block.segments.map((segment, index) => (
            <SegmentView key={index} segment={segment} locale={locale} />
          ))}
        </p>
      );
    case "list":
      return (
        <ul className={styles.list}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className={styles.steps}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "table":
      return <TableView block={block} />;
    case "note":
      return (
        <aside className={styles.note} aria-label={block.title}>
          <p className={styles.noteTitle}>{block.title}</p>
          <p>{block.text}</p>
        </aside>
      );
    case "recommendation":
      return <MembershipRecommendation locale={locale} dictionary={dictionary} />;
  }
}
