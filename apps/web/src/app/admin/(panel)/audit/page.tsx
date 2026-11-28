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
import { Cell, DataTable, TableCard, tableStyles } from "@/components/admin/ui/data-table";
import { EmptyState, PageHeader } from "@/components/admin/ui/kit";
import { Pagination } from "@/components/admin/ui/pagination";
import { ADMIN_ROUTES, AUDIT_PAGE_SIZE, FALLBACK_TIMEZONE } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
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

type Filters = Readonly<Record<string, string | undefined>>;

function pageHref(page: number, filters: Filters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      query.set(key, value);
    }
  }
  if (page > 1) {
    query.set("page", String(page));
  }
  const search = query.toString();
  return search === "" ? ADMIN_ROUTES.audit : `${ADMIN_ROUTES.audit}?${search}`;
}

function AuditRows({ rows, timezone }: { rows: readonly AuditRowView[]; timezone: string }) {
  const { columns } = getAdminDictionary().audit;
  return rows.map((row) => (
    <tr key={row.id}>
      <Cell label={columns.time} muted nowrap>
        {formatDateTime(row.at, timezone)}
      </Cell>
      <Cell label={columns.actor}>{row.actor}</Cell>
      <Cell label={columns.action} strong>
        {row.action}
      </Cell>
      <Cell label={columns.subject}>{row.subject}</Cell>
      <Cell label={columns.details} muted>
        {row.details.map((line) => (
          <bdi key={line} className={tableStyles.line}>
            {line}
          </bdi>
        ))}
      </Cell>
    </tr>
  ));
}

interface PagerProps {
  readonly text: AdminDictionary["audit"];
  readonly page: number;
  readonly shown: number;
  readonly total: number;
  readonly filters: Filters;
}

/** «1 إلى 25 من 310» ورابطا الأحدث والأقدم. */
function AuditPagination({ text, page, shown, total, filters }: PagerProps) {
  const from = (page - 1) * AUDIT_PAGE_SIZE + 1;
  const range = fill(text.range, {
    from: formatNumber(shown === 0 ? 0 : from),
    to: formatNumber(shown === 0 ? 0 : from + shown - 1),
    total: formatNumber(total),
  });
  const hasOlder = page * AUDIT_PAGE_SIZE < total;
  return (
    <Pagination
      label={text.pagination}
      range={range}
      rangeTestId="audit-range"
      previous={{ label: text.newer, href: page > 1 ? pageHref(page - 1, filters) : null }}
      next={{ label: text.older, href: hasOlder ? pageHref(page + 1, filters) : null }}
    />
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
      <PageHeader title={audit.title} description={audit.lead} />
      <TableCard
        toolbar={<AuditFilters text={audit} entityType={entityType} actorKind={actorKind} />}
        footer={
          log.total === 0 ? undefined : (
            <AuditPagination
              text={audit}
              page={page}
              shown={rows.length}
              total={log.total}
              filters={{ entity: entityType, actor: actorKind }}
            />
          )
        }
      >
        {rows.length === 0 ? (
          <EmptyState icon="audit" title={audit.emptyTitle} description={audit.emptyLead} />
        ) : (
          <DataTable
            caption={audit.title}
            columns={Object.values(audit.columns)}
            testId="audit-table"
            sticky
          >
            <AuditRows rows={rows} timezone={club?.timezone ?? FALLBACK_TIMEZONE} />
          </DataTable>
        )}
      </TableCard>
    </>
  );
}
