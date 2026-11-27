import Link from "next/link";
import { contentNamespacePath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import type { TextRow } from "@/server/admin/content/texts-view";
import { Cell, DataTable } from "../ui/data-table";
import { Badge } from "../ui/kit";
import { PathText } from "./entry-parts";
import styles from "./content.module.css";

interface TextsTableProps {
  readonly rows: readonly TextRow[];
  readonly text: AdminDictionary["content"];
}

/** رابط النص في صفحة مساحته، على صفّه نفسه. */
export function textAnchor(path: string): string {
  return `text-${path}`;
}

function rowHref(path: string): string {
  return `${contentNamespacePath(path.split(".")[0] ?? path)}#${textAnchor(path)}`;
}

export function StatusBadge({
  row,
  text,
}: {
  readonly row: TextRow;
  readonly text: AdminDictionary["content"];
}) {
  return "entry" in row ? (
    <Badge>{text.statuses.default}</Badge>
  ) : (
    <Badge tone="neutral">{text.statuses.locked}</Badge>
  );
}

/** نتائج البحث: المسار، والافتراضي باللغتين، والحالة، ورابط إلى صف النص في مساحته. */
export function TextsTable({ rows, text }: TextsTableProps) {
  const { columns } = text.texts;
  return (
    <DataTable
      caption={text.texts.resultsTitle}
      columns={[columns.path, columns.default, columns.status]}
      actionsLabel={text.texts.open}
      testId="texts-results"
      compact
    >
      {rows.map((row) => (
        <tr key={row.path}>
          <Cell label={columns.path} slot="title">
            <PathText path={row.path} />
          </Cell>
          <Cell label={columns.default} slot="value">
            <span className={styles.defaults}>
              <span>{row.defaults.ar}</span>
              <bdi className={styles.defaultEn} dir="ltr">
                {row.defaults.en}
              </bdi>
            </span>
          </Cell>
          <Cell label={columns.status} slot="badge" nowrap>
            <StatusBadge row={row} text={text} />
          </Cell>
          <Cell label="" align="end" slot="aside">
            <Link
              href={rowHref(row.path)}
              prefetch={false}
              aria-label={fill(text.texts.openLabel, { path: row.path })}
            >
              {text.texts.open}
            </Link>
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
