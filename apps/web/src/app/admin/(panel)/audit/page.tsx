import {
  AUDIT_ACTOR_KINDS,
  AUDIT_ENTITY_TYPES,
  listAuditLogs,
  listStaff,
  type AuditActorKind,
  type AuditEntityFilter,
} from "@masar/db";
import type { Metadata } from "next";
import { AuditFilters } from "@/components/admin/audit-filters";
import { AuditPager } from "@/components/admin/audit-pager";
import { PageHeader, pageStyles } from "@/components/admin/page-parts";
import { AUDIT_PAGE_SIZE, FALLBACK_TIMEZONE } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { auditRowView, type AuditRowView } from "@/server/admin/audit-view";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().audit.title };
}

const MAX_PAGE = 10_000;

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function pageNumber(value: unknown): number {
  const page = typeof value === "string" && /^[0-9]{1,5}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(page, 1), MAX_PAGE);
}

interface RowsProps {
  readonly rows: readonly AuditRowView[];
  readonly timezone: string;
}

function AuditRows({ rows, timezone }: RowsProps) {
  const { columns } = getAdminDictionary().audit;
  return (
    <tbody>
      {rows.map((row) => (
        <tr key={row.id}>
          <td data-label={columns.time} className={pageStyles.muted}>
            {formatDateTime(row.at, timezone)}
          </td>
          <td data-label={columns.actor}>{row.actor}</td>
          <td data-label={columns.action} className={pageStyles.strong}>
            {row.action}
          </td>
          <td data-label={columns.subject}>{row.subject}</td>
          <td data-label={columns.details} className={pageStyles.muted}>
            {row.details.map((line) => (
              <bdi key={line} className={pageStyles.detailLine}>
                {line}
              </bdi>
            ))}
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** سجل التدقيق: تصفية بنوع الكيان والفاعل، وصفحات، الأحدث أولًا. قراءة فقط. */
export default async function AuditPage(props: PageProps<"/admin/audit">) {
  const { staff } = await requireStaff("audit.read");
  const query = await props.searchParams;
  const entityType: AuditEntityFilter | undefined = oneOf(AUDIT_ENTITY_TYPES, query.entity);
  const actorKind: AuditActorKind | undefined = oneOf(AUDIT_ACTOR_KINDS, query.actor);
  const page = pageNumber(query.page);
  const db = getDb();
  const [log, members, club] = await Promise.all([
    listAuditLogs(db, {
      clubId: staff.clubId,
      page,
      pageSize: AUDIT_PAGE_SIZE,
      ...(entityType === undefined ? {} : { entityType }),
      ...(actorKind === undefined ? {} : { actorKind }),
    }),
    listStaff(db, staff.clubId),
    staffClub(staff.clubId),
  ]);
  const dictionary = getAdminDictionary();
  const { audit } = dictionary;
  const names = new Map(members.map((member) => [member.id, member.displayName]));
  const rows = log.rows.map((row) => auditRowView(row, names, dictionary));
  return (
    <>
      <PageHeader title={audit.title} lead={audit.lead} />
      <AuditFilters text={audit} entityType={entityType} actorKind={actorKind} />
      {rows.length === 0 ? (
        <p className={pageStyles.empty}>{audit.empty}</p>
      ) : (
        <div className={pageStyles.tableWrap}>
          <table className={pageStyles.table} data-testid="audit-table">
            <caption>{audit.title}</caption>
            <thead>
              <tr>
                {Object.values(audit.columns).map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <AuditRows rows={rows} timezone={club?.timezone ?? FALLBACK_TIMEZONE} />
          </table>
        </div>
      )}
      <AuditPager
        text={audit}
        page={page}
        shown={rows.length}
        total={log.total}
        filters={{ entity: entityType, actor: actorKind }}
      />
    </>
  );
}
