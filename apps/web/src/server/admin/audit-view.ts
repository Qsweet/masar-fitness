import { STAFF_AUDIT_ENTITY, UNKNOWN_STAFF_ID, type AuditRow } from "@masar/db";
import { parsePlainDate } from "@masar/domain";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { formatPlainDay } from "@/i18n/admin/format";

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

/**
 * الحالة قبل وبعد بنص كيانها: أدوار الموظفين وحالاتهم، وحالات الطلب والاشتراك ومحاولة الدفع (الرمز
 * نفسه «expired» له نص لكل كيان). ما لا ترجمة له يُعرض برمزه.
 */
function stateText(state: string, entityType: string, dictionary: AdminDictionary): string {
  const { order, membership, attempt, product, promotion } = dictionary.sales.statuses;
  const maps: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    order,
    membership,
    payment_attempt: attempt,
    product,
    promotion,
    [STAFF_AUDIT_ENTITY]: { ...dictionary.roles, ...dictionary.statuses },
  };
  const map = Object.hasOwn(maps, entityType) ? maps[entityType] : undefined;
  return map === undefined ? state : lookup(map, state, state);
}

function transition(row: AuditRow, dictionary: AdminDictionary): string[] {
  if (row.toState === null) {
    return [];
  }
  const to = stateText(row.toState, row.entityType, dictionary);
  if (row.fromState === null) {
    return [to];
  }
  return [`${stateText(row.fromState, row.entityType, dictionary)} ← ${to}`];
}

/** مفاتيح قيمها تواريخ تقويمية (‎YYYY-MM-DD‎): تُعرض بصيغة اللوحة، فالشرطات تنقلب في RTL. */
const DAY_KEYS = ["startsOn", "endsOn", "receivedOn"];

function dayText(raw: string): string {
  const day = parsePlainDate(raw);
  return day.ok ? formatPlainDay(day.value) : raw;
}

/** مفاتيح قيمها رموز لها نص في القاموس: المفتاح ← خريطة نصوصه. */
function codeMaps(
  dictionary: AdminDictionary,
): Readonly<Record<string, Readonly<Record<string, string>>>> {
  const text = dictionary.audit;
  const { statuses, promotions } = dictionary.sales;
  return {
    reason: text.reasons,
    source: text.sources,
    method: text.methods,
    kind: statuses.itemKind,
    scope: promotions.form.scopes,
    discountKind: promotions.form.kinds,
    startRuleBefore: statuses.startRule,
    startRuleAfter: statuses.startRule,
    target: dictionary.content.namespaces,
    platform: text.platforms,
  };
}

const NO_VALUE = "—";
const LIST_SEPARATOR = "، ";

/** قائمة الحقول المتغيرة (`title_ar,price`) بأسمائها. */
function changedText(raw: string, text: AdminDictionary["audit"]): string {
  return raw
    .split(",")
    .map((field) => lookup(text.changedFields, field, field))
    .join(LIST_SEPARATOR);
}

function valueText(key: string, value: unknown, dictionary: AdminDictionary): string {
  const text = dictionary.audit;
  if (typeof value === "boolean") {
    return value ? dictionary.common.yes : dictionary.common.no;
  }
  if (typeof value !== "string" && typeof value !== "number") {
    return NO_VALUE;
  }
  const raw = String(value);
  if (DAY_KEYS.includes(key)) {
    return dayText(raw);
  }
  if (key === "provider") {
    return lookup(text.providers, raw, text.unknownProvider);
  }
  if (key === "changed") {
    return changedText(raw, text);
  }
  const maps = codeMaps(dictionary);
  return Object.hasOwn(maps, key) ? lookup(maps[key] ?? {}, raw, raw) : raw;
}

function dataLines(row: AuditRow, dictionary: AdminDictionary): string[] {
  return Object.entries(row.data).map(
    ([key, value]) =>
      `${lookup(dictionary.audit.details, key, key)}: ${valueText(key, value, dictionary)}`,
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
    action: lookup({ ...text.salesActions, ...text.actions }, row.action, row.action),
    subject: subjectText(row, names, text),
    details: [...transition(row, dictionary), ...dataLines(row, dictionary)],
  };
}
