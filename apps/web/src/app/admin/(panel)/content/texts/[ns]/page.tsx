import { hasPermission } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LockedTexts } from "@/components/admin/content/locked-texts";
import { TextsForm } from "@/components/admin/content/texts-form";
import { Card, EmptyState, Notice, noticeText, PageHeader } from "@/components/admin/ui/kit";
import { getAdminDictionary, lookup } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { saveTextsAction } from "@/server/admin/actions/content-texts";
import { loadContentState } from "@/server/admin/content/state";
import { formVersion, textRows } from "@/server/admin/content/texts-rows";
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
 * نصوص مساحة واحدة (ADMIN_A3_CONTENT §9): نموذج التجاوزات في المسودة لما يُعدَّل، وتحته ما يبقى من
 * الكود بسببه. الحفظ لا يغيّر الموقع حتى ينشر من يملك النشر.
 */
export default async function ContentNamespacePage(props: PageProps<"/admin/content/texts/[ns]">) {
  const { staff } = await requireStaff("content.read");
  const { ns } = await props.params;
  const registry = textRegistry();
  const texts = namespaceTexts(registry, ns) ?? notFound();
  const dictionary = getAdminDictionary();
  const text = dictionary.content;
  const rows = textRows(
    texts.editable,
    await loadContentState(staff.clubId, registry),
    staff.role,
    text,
  );
  const total = texts.editable.length + texts.locked.length;
  return (
    <>
      <PageHeader
        title={lookup(text.namespaces, ns, ns)}
        description={fill(text.namespace.lead, { count: formatNumber(total) })}
      />
      <Notice text={noticeText((await props.searchParams).done, dictionary)} />
      <Card title={text.namespace.editableTitle} description={text.namespace.editableLead}>
        {rows.length === 0 ? (
          <EmptyState icon="texts" title={text.namespace.noEditable} />
        ) : (
          <TextsForm
            key={formVersion(rows)}
            action={saveTextsAction}
            namespace={ns}
            rows={rows}
            text={text}
            errors={dictionary.errors}
            canWrite={hasPermission(staff.role, "content.write")}
          />
        )}
      </Card>
      <LockedTexts items={texts.locked} text={text} />
    </>
  );
}
