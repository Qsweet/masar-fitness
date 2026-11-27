/**
 * قراءة الشريط في المسودة (ADMIN_A3_SLIDER §2، §5): الشرائح بترتيبها ومعها وصف صورتيها، وإعدادات
 * الشريط (غياب الصف = الافتراضي). لكل صف رمز قفل متفائل من `updated_at`.
 */
import {
  DEFAULT_SLIDER_SETTINGS,
  type Slide,
  type SlideLink,
  type SliderSettings,
  type SliderState,
} from "@masar/domain";
import type { Db } from "../client";
import type { Tx } from "../commerce/transaction";
import type { Prisma } from "../generated/prisma/client";
import { assetOf } from "./media";

export interface DraftSlide extends Slide {
  readonly position: number;
  readonly lockToken: string;
  readonly updatedAt: Date;
}

export interface DraftSlider {
  readonly settings: SliderSettings;
  /** رمز قفل الإعدادات؛ فارغ قبل أول حفظ. */
  readonly settingsToken: string;
  readonly settingsUpdatedAt: Date | null;
  readonly slides: readonly DraftSlide[];
}

const WITH_IMAGES = { desktop: true, mobile: true } as const;
type SlideRow = Prisma.ContentSlideGetPayload<{ include: typeof WITH_IMAGES }>;

export function lockTokenOf(at: Date): string {
  return String(at.getTime());
}

function linkOf(row: SlideRow): SlideLink {
  if (row.linkKind === "internal") {
    return { kind: "internal", path: row.linkTarget };
  }
  if (row.linkKind === "external") {
    return { kind: "external", url: row.linkTarget, newTab: row.linkNewTab };
  }
  return { kind: "none" };
}

function slideOf(row: SlideRow): DraftSlide {
  return {
    id: row.id,
    desktop: assetOf(row.desktop),
    mobile: row.mobile === null ? null : assetOf(row.mobile),
    decorative: row.decorative,
    alt: { ar: row.altAr, en: row.altEn },
    texts: {
      ar: { eyebrow: row.eyebrowAr, title: row.titleAr, subtitle: row.subtitleAr, cta: row.ctaAr },
      en: { eyebrow: row.eyebrowEn, title: row.titleEn, subtitle: row.subtitleEn, cta: row.ctaEn },
    },
    link: linkOf(row),
    clickTarget: row.clickTarget === "slide" ? "slide" : "button",
    active: row.active,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    position: row.position,
    lockToken: lockTokenOf(row.updatedAt),
    updatedAt: row.updatedAt,
  };
}

/** الوصف وحده كما يدخل اللقطة: بلا حقول المكتبة (الحجم والاسم) ولا رموز القفل. */
function plainSlide(slide: DraftSlide): Slide {
  const image = (value: Slide["desktop"]) => ({
    id: value.id,
    hash: value.hash,
    width: value.width,
    height: value.height,
    widths: value.widths,
    blur: value.blur,
    color: value.color,
  });
  return {
    id: slide.id,
    desktop: image(slide.desktop),
    mobile: slide.mobile === null ? null : image(slide.mobile),
    decorative: slide.decorative,
    alt: slide.alt,
    texts: slide.texts,
    link: slide.link,
    clickTarget: slide.clickTarget,
    active: slide.active,
    startsAt: slide.startsAt,
    endsAt: slide.endsAt,
  };
}

export function draftSliderState(draft: DraftSlider): SliderState {
  return { settings: draft.settings, slides: draft.slides.map(plainSlide) };
}

export async function loadDraftSlider(db: Db | Tx, clubId: string): Promise<DraftSlider> {
  const [rows, settings] = await Promise.all([
    db.contentSlide.findMany({
      where: { clubId },
      include: WITH_IMAGES,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    db.contentSliderSettings.findUnique({ where: { clubId } }),
  ]);
  return {
    settings:
      settings === null
        ? DEFAULT_SLIDER_SETTINGS
        : { autoplay: settings.autoplay, intervalMs: settings.intervalMs },
    settingsToken: settings === null ? "" : lockTokenOf(settings.updatedAt),
    settingsUpdatedAt: settings?.updatedAt ?? null,
    slides: rows.map(slideOf),
  };
}
