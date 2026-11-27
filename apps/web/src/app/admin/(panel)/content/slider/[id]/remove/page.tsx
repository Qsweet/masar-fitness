import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import { slideName } from "@/components/admin/slider/slider-diff";
import { Card, PageHeader, uiStyles } from "@/components/admin/ui/kit";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { removeSlideAction } from "@/server/admin/actions/content-slider";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { loadSliderAdmin } from "@/server/admin/slider/slider-view";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().slider.breadcrumbs.remove };
}

/** تأكيد إزالة شريحة من المسودة: المنشور يبقى حتى النشر، والإصدارات السابقة تحفظها. */
export default async function RemoveSlidePage(
  props: PageProps<"/admin/content/slider/[id]/remove">,
) {
  const { staff } = await requireStaff("content.write");
  const { id } = await props.params;
  const dictionary = getAdminDictionary();
  const text = dictionary.slider;
  const { draft } = await loadSliderAdmin(staff.clubId);
  const slide = isUuid(id) ? draft.slides.find((item) => item.id === id) : undefined;
  if (slide === undefined) {
    notFound();
  }
  return (
    <>
      <PageHeader
        title={fill(text.remove.title, { n: formatNumber(slide.position + 1) })}
        description={text.remove.lead}
      />
      <Card narrow>
        <p>
          <bdi>{slideName(slide, text)}</bdi>
        </p>
        <ul className={uiStyles.consequences}>
          {text.remove.consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <AdminForm
          action={removeSlideAction}
          labels={{ submit: text.remove.submit, errors: dictionary.errors }}
          variant="danger"
        >
          <input type="hidden" name="id" value={slide.id} />
          <input type="hidden" name="lockToken" value={slide.lockToken} />
        </AdminForm>
      </Card>
    </>
  );
}
