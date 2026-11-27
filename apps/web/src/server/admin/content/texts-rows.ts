import { hasPermission, TEXT_LIMITS, type StaffRole, type TextEntry } from "@masar/domain";
import type { TextRowView } from "@/components/admin/content/texts-form";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { combinedStatus, entryStates } from "./namespace-view";
import type { ContentState } from "./state";

/** صفوف نموذج المساحة كما يرسمها المتصفح: نصوص جاهزة وحالة كل لغة، بلا القاموس العام. */
export function textRows(
  entries: readonly TextEntry[],
  state: ContentState,
  role: StaffRole,
  text: AdminDictionary["content"],
): TextRowView[] {
  const states = entryStates(entries, state);
  return entries.flatMap((entry) => {
    const locales = states.get(entry.path);
    if (locales === undefined) {
      return [];
    }
    const limit = TEXT_LIMITS[entry.kind];
    return [
      {
        path: entry.path,
        kind: `${text.kinds[entry.kind]} · ${fill(text.namespace.limit, { limit: formatNumber(limit) })}`,
        limit,
        multiline:
          entry.kind === "paragraph" || entry.kind === "metaDescription" || entry.kind === "line",
        readOnly: !hasPermission(role, entry.permission),
        status: combinedStatus(locales),
        defaults: entry.defaults,
        placeholders: entry.placeholders,
        locales,
      },
    ];
  });
}

/** يتغير مع كل حفظ: النموذج يُرسم من جديد بقيم القاعدة بعد التحويل. */
export function formVersion(rows: readonly TextRowView[]): string {
  return rows.map((row) => `${row.locales.ar.lockToken}.${row.locales.en.lockToken}`).join("|");
}
