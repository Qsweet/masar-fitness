/**
 * الشريحة ← أعمدة `content_slides`، والاستبدال الكامل لشريط المسودة بلقطة (الاسترجاع والتجاهل،
 * ADMIN_A3_SLIDER §7). المعرّفات تبقى كما في اللقطة، ورموز القفل أحدث من كل ما سبق، فأي نموذج فُتح
 * قبل الاستبدال يُرفض.
 */
import { DEFAULT_SLIDER_SETTINGS, type SlideContent, type SliderState } from "@masar/domain";
import type { Tx } from "../commerce/transaction";
import { loadDraftSlider } from "./slides-read";

export function slideColumns(content: SlideContent) {
  const { link, texts } = content;
  return {
    desktopAssetId: content.desktop.id,
    mobileAssetId: content.mobile?.id ?? null,
    decorative: content.decorative,
    altAr: content.alt.ar,
    altEn: content.alt.en,
    eyebrowAr: texts.ar.eyebrow,
    eyebrowEn: texts.en.eyebrow,
    titleAr: texts.ar.title,
    titleEn: texts.en.title,
    subtitleAr: texts.ar.subtitle,
    subtitleEn: texts.en.subtitle,
    ctaAr: texts.ar.cta,
    ctaEn: texts.en.cta,
    linkKind: link.kind,
    linkTarget: link.kind === "internal" ? link.path : link.kind === "external" ? link.url : "",
    linkNewTab: link.kind === "external" && link.newTab,
    clickTarget: content.clickTarget,
    active: content.active,
    startsAt: content.startsAt,
    endsAt: content.endsAt,
  };
}

interface ReplaceInput {
  readonly clubId: string;
  readonly staffId: string;
  readonly now: Date;
}

/** يستبدل شرائح المسودة وإعداداتها بشريط لقطة، تحت قفل المحتوى الذي أخذه المستدعي. */
export async function replaceDraftSlider(
  tx: Tx,
  input: ReplaceInput,
  slider: SliderState,
): Promise<void> {
  const current = await loadDraftSlider(tx, input.clubId);
  const times = [
    input.now.getTime(),
    ...current.slides.map((slide) => slide.updatedAt.getTime() + 1),
    (current.settingsUpdatedAt?.getTime() ?? 0) + 1,
  ];
  const at = new Date(Math.max(...times));
  await tx.contentSlide.deleteMany({ where: { clubId: input.clubId } });
  for (const [position, slide] of slider.slides.entries()) {
    await tx.contentSlide.create({
      data: {
        id: slide.id,
        clubId: input.clubId,
        position,
        ...slideColumns(slide),
        createdBy: input.staffId,
        createdAt: at,
        updatedBy: input.staffId,
        updatedAt: at,
      },
    });
  }
  const settings = slider.settings;
  const isDefault =
    settings.autoplay === DEFAULT_SLIDER_SETTINGS.autoplay &&
    settings.intervalMs === DEFAULT_SLIDER_SETTINGS.intervalMs;
  if (isDefault && current.settingsUpdatedAt === null) {
    return;
  }
  const values = { ...settings, updatedBy: input.staffId, updatedAt: at };
  await tx.contentSliderSettings.upsert({
    where: { clubId: input.clubId },
    create: { clubId: input.clubId, ...values },
    update: values,
  });
}
