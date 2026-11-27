import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SlideForm } from "@/components/admin/slider/slide-form";
import { ButtonLink, Card, PageHeader } from "@/components/admin/ui/kit";
import { slideRemovePath } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { saveSlideAction } from "@/server/admin/actions/content-slider";
import { clubTimezone } from "@/server/admin/content/timezone";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { slideValues } from "@/server/admin/slider/slide-values";
import { assetOptions, loadSliderAdmin, targetOptions } from "@/server/admin/slider/slider-view";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().slider.breadcrumbs.slide };
}

/**
 * تعديل شريحة في المسودة (docs/ADMIN_A3_SLIDER.md §11): النموذج بقيمها ورمز قفلها، والمنشور الآن بجانب
 * كل حقل يختلف، والمعاينة الحية، ورابط الإزالة.
 */
export default async function SlidePage(props: PageProps<"/admin/content/slider/[id]">) {
  const { staff } = await requireStaff("content.write");
  const { id } = await props.params;
  const dictionary = getAdminDictionary();
  const text = dictionary.slider;
  const [{ draft, published }, assets, targets, timeZone] = await Promise.all([
    loadSliderAdmin(staff.clubId),
    assetOptions(staff.clubId),
    targetOptions(text),
    clubTimezone(staff.clubId),
  ]);
  const slide = isUuid(id) ? draft.slides.find((item) => item.id === id) : undefined;
  if (slide === undefined) {
    notFound();
  }
  const live = published.slides.find((item) => item.id === id);
  return (
    <>
      <PageHeader
        title={fill(text.form.editTitle, { n: formatNumber(slide.position + 1) })}
        description={text.form.lead}
      >
        <ButtonLink href={slideRemovePath(slide.id)} variant="danger">
          {text.form.remove}
        </ButtonLink>
      </PageHeader>
      <Card>
        <SlideForm
          key={slide.lockToken}
          action={saveSlideAction}
          id={slide.id}
          lockToken={slide.lockToken}
          values={slideValues(slide, timeZone)}
          published={live === undefined ? {} : slideValues(live, timeZone)}
          assets={assets}
          targets={targets}
          timeZone={timeZone}
          dictionary={dictionary}
        />
      </Card>
    </>
  );
}
