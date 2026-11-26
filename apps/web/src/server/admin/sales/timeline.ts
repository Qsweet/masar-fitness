import type { AuditRow } from "@masar/db";
import type { AdminDictionary } from "@/i18n/admin";
import { auditRowView } from "../audit-view";

/**
 * الخط الزمني للطلب من سجل التدقيق: كل حدث بعنوانه العربي وفاعله وما يهم الموظف من تفاصيله. منطق صرف
 * يُختبر بلا قاعدة. المعرّفات الداخلية والمبالغ الخام لا تُعرض هنا (المبلغ في بطاقة الدفع).
 */
export interface TimelineEvent {
  readonly id: string;
  readonly at: Date;
  readonly title: string;
  readonly actor: string;
  readonly lines: readonly string[];
}

/** ما يُعرض من `data` في الخط الزمني. غيره يبقى في سجل التدقيق الكامل. */
const SHOWN_KEYS = [
  "reason",
  "method",
  "externalReference",
  "receivedOn",
  "provider",
  "startsOn",
  "endsOn",
];

function shownData(data: AuditRow["data"]): Record<string, unknown> {
  return Object.fromEntries(
    SHOWN_KEYS.filter((key) => Object.hasOwn(data, key))
      .map((key) => [key, data[key]] as const)
      .filter(([, value]) => typeof value === "string" || typeof value === "number"),
  );
}

export function timelineEvents(
  rows: readonly AuditRow[],
  names: ReadonlyMap<string, string>,
  dictionary: AdminDictionary,
): TimelineEvent[] {
  return rows.map((row) => {
    // الانتقال بين الحالات يقوله العنوان نفسه («أُلغي الطلب»)، فلا يُكرَّر برموزه
    const view = auditRowView(
      { ...row, fromState: null, toState: null, data: shownData(row.data) },
      names,
      dictionary,
    );
    return {
      id: row.id,
      at: row.createdAt,
      title: view.action,
      actor: view.actor,
      lines: view.details,
    };
  });
}
