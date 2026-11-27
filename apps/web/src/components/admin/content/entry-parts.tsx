import { TEXT_LIMITS, type ContentLocale, type TextEntry } from "@masar/domain";
import { Fragment } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { Badge } from "../ui/kit";
import styles from "./content.module.css";

type Text = AdminDictionary["content"];

/** مسار النص بخط ثابت، ويلتف عند النقاط لا وسط الاسم. */
export function PathText({ path }: { readonly path: string }) {
  return (
    <span className={styles.path}>
      {path.split(".").map((segment, index) => (
        <Fragment key={`${String(index)}-${segment}`}>
          {index === 0 ? null : (
            <>
              .<wbr />
            </>
          )}
          {segment}
        </Fragment>
      ))}
    </span>
  );
}

/** رأس صف النص: المسار ونوعه وحده، ومن يعدّله إن كان من حقائق النادي. */
export function EntryHead({ entry, text }: { readonly entry: TextEntry; readonly text: Text }) {
  return (
    <div className={styles.entryHead}>
      <PathText path={entry.path} />
      <Badge tone="info">{text.kinds[entry.kind]}</Badge>
      <span className={styles.note}>
        {fill(text.namespace.limit, { limit: formatNumber(TEXT_LIMITS[entry.kind]) })}
      </span>
      {entry.permission === "content.facts" ? (
        <span className={styles.note}>{text.namespace.factsOnly}</span>
      ) : null}
    </div>
  );
}

/** العناصر النائبة كما يجب أن تبقى في النص. */
export function Placeholders({
  names,
  label,
}: {
  readonly names: readonly string[];
  readonly label: string;
}) {
  if (names.length === 0) {
    return null;
  }
  return (
    <ul className={styles.chips} aria-label={label}>
      {names.map((name) => (
        <li key={name} className={styles.chip}>
          {`{${name}}`}
        </li>
      ))}
    </ul>
  );
}

const DIRECTIONS: Readonly<Record<ContentLocale, "rtl" | "ltr">> = { ar: "rtl", en: "ltr" };

export function directionOf(locale: ContentLocale): "rtl" | "ltr" {
  return DIRECTIONS[locale];
}

/** الافتراضي بلغة واحدة: قراءةً، باتجاه لغته. */
export function DefaultText({
  entry,
  locale,
  text,
}: {
  readonly entry: TextEntry;
  readonly locale: ContentLocale;
  readonly text: Text;
}) {
  return (
    <div className={styles.side}>
      <span className={styles.sideLabel}>
        {text.namespace.defaultLabel} · {text.locales[locale]}
      </span>
      <p className={styles.defaultText} dir={directionOf(locale)} lang={locale}>
        {entry.defaults[locale]}
      </p>
      <Placeholders names={entry.placeholders[locale]} label={text.namespace.placeholders} />
    </div>
  );
}
