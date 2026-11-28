import { listReleases, type ReleaseListItem } from "@masar/db";
import type { Metadata } from "next";
import { Cell, DataTable, RowLink, TableCard } from "@/components/admin/ui/data-table";
import { Badge, EmptyState, Notice, noticeText, PageHeader } from "@/components/admin/ui/kit";
import { Pagination } from "@/components/admin/ui/pagination";
import { ADMIN_ROUTES, CONTENT_HISTORY_PAGE_SIZE, releasePath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { clubTimezone } from "@/server/admin/content/timezone";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.history.title };
}

const MAX_PAGE = 10_000;

function pageNumber(value: unknown): number {
  const page = typeof value === "string" && /^[0-9]{1,5}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(page, 1), MAX_PAGE);
}

function pageHref(page: number): string {
  return page > 1
    ? `${ADMIN_ROUTES.contentHistory}?page=${String(page)}`
    : ADMIN_ROUTES.contentHistory;
}

type Text = AdminDictionary["content"]["history"];

function Rows({
  items,
  timezone,
  text,
}: {
  readonly items: readonly ReleaseListItem[];
  readonly timezone: string;
  readonly text: Text;
}) {
  const { columns } = text;
  return (
    <DataTable
      caption={text.title}
      columns={[
        columns.seq,
        columns.source,
        columns.by,
        columns.at,
        { label: columns.changes, align: "numeric" },
      ]}
      testId="content-history"
      compact
    >
      {items.map((item) => (
        <tr key={item.id}>
          <Cell label={columns.seq} slot="title">
            <RowLink
              href={releasePath(item.id)}
              label={fill(text.openLabel, { seq: formatNumber(item.seq) })}
            >
              {formatNumber(item.seq)}
            </RowLink>
          </Cell>
          <Cell label={columns.source} slot="badge">
            <Badge tone={item.source === "rollback" ? "warning" : "success"}>
              {item.rolledBackFromSeq === null
                ? text.sources[item.source]
                : fill(text.rollbackOf, { seq: formatNumber(item.rolledBackFromSeq) })}
            </Badge>
          </Cell>
          <Cell label={columns.by} slot="value">
            {item.publisherName}
          </Cell>
          <Cell label={columns.at} slot="meta" nowrap muted>
            {formatDateTime(item.publishedAt, timezone)}
          </Cell>
          <Cell label={columns.changes} align="numeric">
            {formatNumber(item.changedCount)}
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}

/** سجل الإصدارات (ADMIN_A3_CONTENT §8.5): الأحدث أولًا، بصفحات. */
export default async function ContentHistoryPage(props: PageProps<"/admin/content/history">) {
  const { staff } = await requireStaff("content.read");
  const query = await props.searchParams;
  const page = pageNumber(query.page);
  const dictionary = getAdminDictionary();
  const text = dictionary.content.history;
  const [{ items, total }, timezone] = await Promise.all([
    listReleases(getDb(), staff.clubId, {
      offset: (page - 1) * CONTENT_HISTORY_PAGE_SIZE,
      limit: CONTENT_HISTORY_PAGE_SIZE,
    }),
    clubTimezone(staff.clubId),
  ]);
  return (
    <>
      <PageHeader title={text.title} description={text.lead} />
      <Notice text={noticeText(query.done, dictionary)} />
      <TableCard
        footer={
          total <= CONTENT_HISTORY_PAGE_SIZE ? undefined : (
            <HistoryPagination page={page} total={total} shown={items.length} text={text} />
          )
        }
      >
        {items.length === 0 ? (
          <EmptyState icon="publish" title={text.emptyTitle} description={text.emptyLead} />
        ) : (
          <Rows items={items} timezone={timezone} text={text} />
        )}
      </TableCard>
    </>
  );
}

interface HistoryPaginationProps {
  readonly page: number;
  readonly total: number;
  readonly shown: number;
  readonly text: Text;
}

function HistoryPagination({ page, total, shown, text }: HistoryPaginationProps) {
  const from = (page - 1) * CONTENT_HISTORY_PAGE_SIZE + 1;
  return (
    <Pagination
      label={text.pagination}
      range={fill(text.range, {
        from: formatNumber(from),
        to: formatNumber(from + shown - 1),
        total: formatNumber(total),
      })}
      previous={{ label: text.newer, href: page > 1 ? pageHref(page - 1) : null }}
      next={{
        label: text.older,
        href: page * CONTENT_HISTORY_PAGE_SIZE < total ? pageHref(page + 1) : null,
      }}
    />
  );
}
