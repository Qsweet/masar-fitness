import Link from "next/link";
import { contentNamespacePath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import type { TextRow } from "@/server/admin/content/texts-view";
import { Cell, DataTable } from "../ui/data-table";
import { Badge } from "../ui/kit";
import {
  combinedStatus,
  type EntryState,
  type LocaleState,
} from "@/server/admin/content/namespace-view";
import { PathText } from "./entry-parts";
import { StatusTag } from "./texts-form";
import styles from "./content.module.css";

interface TextsTableProps {
  readonly rows: readonly TextRow[];
  /** حالة كل نص قابل للتعديل باللغتين، من المسودة والمنشور. */
  readonly states: ReadonlyMap<string, EntryState>;
  readonly text: AdminDictionary["content"];
}

/** رابط النص في صفحة مساحته، على صفّه نفسه. */
export function textAnchor(path: string): string {
  return `text-${path}`;
}

function rowHref(path: string): string {
  return `${contentNamespacePath(path.split(".")[0] ?? path)}#${textAnchor(path)}`;
}

/** القيمة بلغتين في خلية: العربية ثم الإنجليزية خافتة، أو شرطة حين لا قيمة. */
function Pair({ ar, en }: { readonly ar: string | null; readonly en: string | null }) {
  if (ar === null && en === null) {
    return <span aria-hidden="true">—</span>;
  }
  return (
    <span className={styles.defaults}>
      {ar === null ? null : <span>{ar}</span>}
      {en === null ? null : (
        <bdi className={styles.defaultEn} dir="ltr">
          {en}
        </bdi>
      )}
    </span>
  );
}

function override(state: LocaleState | undefined, published: boolean): string | null {
  if (state === undefined) {
    return null;
  }
  return published ? state.published : state.overridden ? state.value : null;
}

/** نتائج البحث: المسار، والافتراضي باللغتين، والحالة، ورابط إلى صف النص في مساحته. */
export function TextsTable({ rows, states, text }: TextsTableProps) {
  const { columns } = text.texts;
  return (
    <DataTable
      caption={text.texts.resultsTitle}
      columns={[columns.path, columns.default, columns.published, columns.draft, columns.status]}
      actionsLabel={text.texts.open}
      testId="texts-results"
      compact
    >
      {rows.map((row) => {
        const state = states.get(row.path);
        return (
          <tr key={row.path}>
            <Cell label={columns.path} slot="title">
              <PathText path={row.path} />
            </Cell>
            <Cell label={columns.default} slot="value">
              <Pair ar={row.defaults.ar} en={row.defaults.en} />
            </Cell>
            <Cell label={columns.published}>
              <Pair ar={override(state?.ar, true)} en={override(state?.en, true)} />
            </Cell>
            <Cell label={columns.draft}>
              <Pair ar={override(state?.ar, false)} en={override(state?.en, false)} />
            </Cell>
            <Cell label={columns.status} slot="badge" nowrap>
              {state === undefined ? (
                <Badge>{text.statuses.locked}</Badge>
              ) : (
                <StatusTag status={combinedStatus(state)} text={text} />
              )}
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
        );
      })}
    </DataTable>
  );
}
