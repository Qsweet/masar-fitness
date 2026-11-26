import { STAFF_AUDIT_ENTITY, UNKNOWN_STAFF_ID, type AuditRow } from "@masar/db";
import { lookup, type AdminDictionary } from "@/i18n/admin";

/**
 * صف سجل التدقيق كما يُعرض: كل رمز يكتبه الكود (حدث، فاعل، سبب، دور) يُترجم من القاموس، وما لا
 * ترجمة له يُعرض برمزه كما هو. منطق صرف يُختبر بلا قاعدة.
 */
export interface AuditRowView {
  readonly id: string;
  readonly at: Date;
  readonly actor: string;
  readonly action: string;
  readonly subject: string;
  /** أسطر «التسمية: القيمة» وانتقال الحالة. */
  readonly details: readonly string[];
}

const STAFF_ACTOR_PREFIX = "staff:";
const SHORT_ID_LENGTH = 8;

type Names = ReadonlyMap<string, string>;

function actorText(actor: string, names: Names, text: AdminDictionary["audit"]): string {
  if (actor.startsWith(STAFF_ACTOR_PREFIX)) {
    return names.get(actor.slice(STAFF_ACTOR_PREFIX.length)) ?? text.unknownStaff;
  }
  return lookup(text.actors, actor, actor);
}

function subjectText(row: AuditRow, names: Names, text: AdminDictionary["audit"]): string {
  if (row.entityType !== STAFF_AUDIT_ENTITY) {
    const label = lookup(text.entities, row.entityType, row.entityType);
    return `${label} ${row.entityId.slice(0, SHORT_ID_LENGTH)}`;
  }
  if (row.entityId === UNKNOWN_STAFF_ID) {
    return text.unknownAccount;
  }
  return names.get(row.entityId) ?? text.unknownStaff;
}

/** الحالة قبل وبعد: أدوار الموظفين وحالاتهم تُترجم، وحالات البيع تُعرض برمزها. */
function stateText(state: string, dictionary: AdminDictionary): string {
  return lookup({ ...dictionary.roles, ...dictionary.statuses }, state, state);
}

function transition(row: AuditRow, dictionary: AdminDictionary): string[] {
  if (row.toState === null) {
    return [];
  }
  const to = stateText(row.toState, dictionary);
  return [row.fromState === null ? to : `${stateText(row.fromState, dictionary)} ← ${to}`];
}

function valueText(key: string, value: unknown, text: AdminDictionary["audit"]): string {
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (key === "reason") {
    return lookup(text.reasons, raw, raw);
  }
  return key === "method" ? lookup(text.methods, raw, raw) : raw;
}

function dataLines(row: AuditRow, text: AdminDictionary["audit"]): string[] {
  return Object.entries(row.data).map(
    ([key, value]) => `${lookup(text.details, key, key)}: ${valueText(key, value, text)}`,
  );
}

export function auditRowView(
  row: AuditRow,
  names: Names,
  dictionary: AdminDictionary,
): AuditRowView {
  const text = dictionary.audit;
  return {
    id: row.id,
    at: row.createdAt,
    actor: actorText(row.actor, names, text),
    action: lookup(text.actions, row.action, row.action),
    subject: subjectText(row, names, text),
    details: [...transition(row, dictionary), ...dataLines(row, text)],
  };
}
