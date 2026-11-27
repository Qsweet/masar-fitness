import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DefaultText, EntryHead, PathText } from "@/components/admin/content/entry-parts";
import styles from "@/components/admin/content/content.module.css";
import { textAnchor } from "@/components/admin/content/texts-table";
import { Cell, DataTable } from "@/components/admin/ui/data-table";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui/kit";
import { getAdminDictionary, lookup } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { namespaceTexts } from "@/server/admin/content/texts-view";
import { requireStaff } from "@/server/admin/guard";
import { textRegistry } from "@/server/content/registry";

export async function generateMetadata(
  props: PageProps<"/admin/content/texts/[ns]">,
): Promise<Metadata> {
  const { ns } = await props.params;
  const text = getAdminDictionary().content;
  return { title: lookup(text.namespaces, ns, text.texts.title) };
}

/**
 * نصوص مساحة واحدة: لكل نص قابل للتعديل الافتراضي العربي والإنجليزي متجاورين بعناصرهما النائبة ونوعه
 * وحده، ثم ما يبقى قراءةً بسببه.
 */
export default async function ContentNamespacePage(props: PageProps<"/admin/content/texts/[ns]">) {
  await requireStaff("content.read");
  const { ns } = await props.params;
  const texts = namespaceTexts(textRegistry(), ns) ?? notFound();
  const text = getAdminDictionary().content;
  const total = texts.editable.length + texts.locked.length;
  return (
    <>
      <PageHeader
        title={lookup(text.namespaces, ns, ns)}
        description={fill(text.namespace.lead, { count: formatNumber(total) })}
      />
      <Card title={text.namespace.editableTitle}>
        {texts.editable.length === 0 ? (
          <EmptyState icon="texts" title={text.namespace.noEditable} />
        ) : (
          <ul className={styles.entries}>
            {texts.editable.map((entry) => (
              <li key={entry.path} id={textAnchor(entry.path)} className={styles.entry}>
                <EntryHead entry={entry} text={text} />
                <div className={styles.pair}>
                  <DefaultText entry={entry} locale="ar" text={text} />
                  <DefaultText entry={entry} locale="en" text={text} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {texts.locked.length === 0 ? null : (
        <Card title={text.namespace.lockedTitle} description={text.namespace.lockedLead} flush>
          <DataTable
            caption={text.namespace.lockedTitle}
            columns={[text.texts.columns.path, text.texts.columns.default, text.namespace.reason]}
            testId="texts-locked"
          >
            {texts.locked.map((item) => (
              <tr key={item.path} id={textAnchor(item.path)}>
                <Cell label={text.texts.columns.path}>
                  <PathText path={item.path} />
                </Cell>
                <Cell label={text.texts.columns.default}>
                  <span className={styles.defaults}>
                    <span>{item.defaults.ar}</span>
                    <bdi className={styles.defaultEn} dir="ltr">
                      {item.defaults.en}
                    </bdi>
                  </span>
                </Cell>
                <Cell label={text.namespace.reason} muted>
                  {lookup(text.lockReasons, item.reason, text.lockReasons.notListed)}
                </Cell>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}
    </>
  );
}
