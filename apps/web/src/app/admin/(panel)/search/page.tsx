import type { Metadata } from "next";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/admin-icon";
import {
  commandEntriesFor,
  filterCommands,
  type CommandEntry,
} from "@/components/admin/shell/command-model";
import { ShortcutList } from "@/components/admin/shell/shortcuts-dialog";
import searchStyles from "@/components/admin/shell/search-page.module.css";
import { TextField } from "@/components/admin/ui/fields";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().shell.searchPage.title };
}

const QUERY_MAX_LENGTH = 80;

function Results({
  entries,
  title,
}: {
  readonly entries: readonly CommandEntry[];
  readonly title: string;
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <Card title={title} flush>
      <ul className={searchStyles.list}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link href={entry.href} prefetch={false} className={searchStyles.result}>
              <span className={searchStyles.icon} aria-hidden="true">
                <AdminIcon name={entry.icon} size={16} />
              </span>
              <span className={searchStyles.text}>
                <span className={searchStyles.label}>{entry.label}</span>
                <span className={searchStyles.hint}>{entry.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SearchForm({ query, text }: { query: string; text: AdminDictionary["shell"] }) {
  return (
    <form method="get" action={ADMIN_ROUTES.search} className={searchStyles.form} role="search">
      <TextField
        id="admin-search"
        name="q"
        type="search"
        label={text.searchPage.query}
        defaultValue={query}
        maxLength={QUERY_MAX_LENGTH}
        autoComplete="off"
        placeholder={text.search}
        data-admin-search=""
      />
      <button type="submit" className={buttonClass()}>
        {text.searchPage.submit}
      </button>
    </form>
  );
}

/**
 * صفحة البحث (ADMIN_REDESIGN §4.3): بديل لوحة الأوامر بلا JavaScript، بالمدخلات نفسها المحسوبة من
 * صلاحيات الموظف والمرشِّح نفسه. وفيها قائمة الاختصارات (وجهة زر المساعدة بلا JavaScript).
 */
export default async function AdminSearchPage(props: PageProps<"/admin/search">) {
  const { staff } = await requireStaff("account.self");
  const raw = (await props.searchParams).q;
  // عبارة أطول من الحد تُعامل كفارغة، كحقول اللوحة كلها
  const query = typeof raw === "string" && raw.length <= QUERY_MAX_LENGTH ? raw : "";
  const dictionary = getAdminDictionary();
  const { shell } = dictionary;
  const results = filterCommands(commandEntriesFor(staff.role, dictionary), query);
  return (
    <>
      <PageHeader title={shell.searchPage.title} description={shell.searchPage.lead} />
      <Card>
        <SearchForm query={query} text={shell} />
      </Card>
      {results.length === 0 ? (
        <Card>
          <EmptyState icon="search" title={shell.palette.empty} />
        </Card>
      ) : null}
      <Results
        entries={results.filter((entry) => entry.kind === "page")}
        title={shell.palette.groups.page}
      />
      <Results
        entries={results.filter((entry) => entry.kind === "action")}
        title={shell.palette.groups.action}
      />
      <section id="shortcuts" aria-labelledby="shortcuts-title">
        <Card>
          <h2 id="shortcuts-title" className={searchStyles.heading}>
            {shell.searchPage.shortcutsTitle}
          </h2>
          <ShortcutList text={shell.shortcuts} />
        </Card>
      </section>
    </>
  );
}
