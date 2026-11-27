import type { Metadata } from "next";
import { TextsTable } from "@/components/admin/content/texts-table";
import styles from "@/components/admin/content/content.module.css";
import { TextField } from "@/components/admin/ui/fields";
import { KeyTree, type KeyTreeGroup } from "@/components/admin/ui/key-tree";
import { ButtonLink, buttonClass, Card, EmptyState, PageHeader } from "@/components/admin/ui/kit";
import {
  ADMIN_ROUTES,
  CONTENT_SEARCH_MAX_LENGTH,
  CONTENT_SEARCH_RESULTS,
  contentNamespacePath,
} from "@/config/admin";
import { getAdminDictionary, lookup, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import {
  namespaceSummaries,
  parseTextSearch,
  searchTexts,
  type NamespaceSummary,
} from "@/server/admin/content/texts-view";
import { entryStates } from "@/server/admin/content/namespace-view";
import { loadContentState } from "@/server/admin/content/state";
import { requireStaff } from "@/server/admin/guard";
import { DroppedOverrides } from "@/components/admin/content/dropped-overrides";
import { textRegistry } from "@/server/content/registry";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().content.texts.title };
}

function treeGroups(summaries: readonly NamespaceSummary[], text: AdminDictionary["content"]) {
  const item = (summary: NamespaceSummary) => ({
    href: contentNamespacePath(summary.namespace),
    label: lookup(text.namespaces, summary.namespace, summary.namespace),
    count: fill(text.texts.namespaceCount, {
      editable: formatNumber(summary.editable),
      total: formatNumber(summary.total),
    }),
  });
  const groups: KeyTreeGroup[] = [
    {
      id: "editable",
      label: text.texts.editableGroup,
      open: true,
      items: summaries.filter((summary) => summary.editable > 0).map(item),
    },
    {
      id: "locked",
      label: text.texts.lockedGroup,
      open: false,
      items: summaries.filter((summary) => summary.editable === 0).map(item),
    },
  ];
  return groups;
}

function SearchForm({
  query,
  text,
}: {
  readonly query: string;
  readonly text: AdminDictionary["content"]["texts"];
}) {
  return (
    <form
      method="get"
      action={ADMIN_ROUTES.contentTexts}
      className={styles.search}
      aria-label={text.searchLegend}
    >
      <TextField
        id="texts-search"
        name="q"
        type="search"
        label={text.search}
        hint={text.searchHint}
        defaultValue={query}
        maxLength={CONTENT_SEARCH_MAX_LENGTH}
        autoComplete="off"
      />
      <div className={styles.searchActions}>
        <button type="submit" className={buttonClass()}>
          {text.submit}
        </button>
        {query === "" ? null : (
          <ButtonLink href={ADMIN_ROUTES.contentTexts} variant="ghost">
            {text.clear}
          </ButtonLink>
        )}
      </div>
    </form>
  );
}

/**
 * متصفح النصوص: شجرة المساحات (ما يُعدَّل منها وما يبقى قراءةً) وبحث GET في المسار والنص باللغتين.
 * يعمل بلا JavaScript، والبحث رابط يُشارك ويُحفظ.
 */
export default async function ContentTextsPage(props: PageProps<"/admin/content/texts">) {
  const { staff } = await requireStaff("content.read");
  const query = parseTextSearch((await props.searchParams).q);
  const registry = textRegistry();
  const text = getAdminDictionary().content;
  const results = query === null ? null : searchTexts(registry, query);
  const state = await loadContentState(staff.clubId, registry);
  const states = entryStates([...registry.editable.values()], state);
  return (
    <>
      <PageHeader title={text.texts.title} description={text.texts.lead} />
      <DroppedOverrides dropped={state.draft.dropped} text={text} />
      <Card>
        <SearchForm query={query ?? ""} text={text.texts} />
      </Card>
      <div className={styles.browser}>
        <Card title={text.texts.treeTitle} description={text.texts.treeLead}>
          <KeyTree
            label={text.texts.treeTitle}
            groups={treeGroups(namespaceSummaries(registry), text)}
          />
        </Card>
        {results === null ? null : (
          <Card
            title={text.texts.resultsTitle}
            description={
              results.total > CONTENT_SEARCH_RESULTS
                ? fill(text.texts.resultsTruncated, { shown: formatNumber(CONTENT_SEARCH_RESULTS) })
                : fill(text.texts.resultsCount, { count: formatNumber(results.total) })
            }
            flush={results.total > 0}
          >
            {results.total === 0 ? (
              <EmptyState
                icon="search"
                title={text.texts.noResults}
                description={text.texts.noResultsLead}
              />
            ) : (
              <TextsTable rows={results.rows} states={states} text={text} />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
