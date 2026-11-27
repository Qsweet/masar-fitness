import { MAX_SLIDES } from "@masar/domain";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SlideForm } from "@/components/admin/slider/slide-form";
import { Card, PageHeader } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { saveSlideAction } from "@/server/admin/actions/content-slider";
import { clubTimezone } from "@/server/admin/content/timezone";
import { requireStaff } from "@/server/admin/guard";
import { NEW_SLIDE_VALUES } from "@/server/admin/slider/slide-values";
import { assetOptions, loadSliderAdmin, targetOptions } from "@/server/admin/slider/slider-view";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().slider.form.newTitle };
}

/** شريحة جديدة في المسودة (docs/ADMIN_A3_SLIDER.md §11). الشريط ممتلئ ⇒ العودة إلى القائمة. */
export default async function NewSlidePage() {
  const { staff } = await requireStaff("content.write");
  const dictionary = getAdminDictionary();
  const text = dictionary.slider;
  const [{ draft }, assets, targets, timeZone] = await Promise.all([
    loadSliderAdmin(staff.clubId),
    assetOptions(staff.clubId),
    targetOptions(text),
    clubTimezone(staff.clubId),
  ]);
  if (draft.slides.length >= MAX_SLIDES) {
    redirect(`${ADMIN_ROUTES.contentSlider}?error=slider.too_many`);
  }
  return (
    <>
      <PageHeader title={text.form.newTitle} description={text.form.lead} />
      <Card>
        <SlideForm
          action={saveSlideAction}
          id=""
          lockToken=""
          values={NEW_SLIDE_VALUES}
          published={{}}
          assets={assets}
          targets={targets}
          timeZone={timeZone}
          dictionary={dictionary}
        />
      </Card>
    </>
  );
}
