import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assetUsage,
  createSlide,
  oldestActiveOwnerId,
  oldestClubId,
  staffActor,
  type Db,
  type MediaAsset,
} from "@masar/db";
import { err, ok, validateSlide, type Result, type SlideContext } from "@masar/domain";
import { kitImageFile, SLIDE_KIT, type KitSlide, type SlideKitId } from "@/content/slider-kit/kit";
import { uploadImage } from "../media/upload";
import { kitMessage } from "./messages";

/**
 * عدّة إطلاق الشريط (docs/SLIDER_KIT.md §3): تستورد الصور المصممة بخط الرفع نفسه (الفحص وإعادة الترميز
 * والبصمة والتخزين)، وتنشئ شرائحها في **المسودة** وحدها، منسوبة إلى أقدم مالك نشط. لا نشر أبدًا: المالك
 * يعاين وينشر من اللوحة. التكرار آمن: الصورة تُعرف ببصمتها، وشريحة صورة حاسوبها في المسودة الآن لا تُنشأ
 * ثانية. ما أزاله المالك من المسودة يعود إليها بإعادة التشغيل (مسودة لا تُنشر إلا بيده).
 */
export interface KitDeps {
  readonly db: Db;
  /** الرفع مفتوح (`MEDIA_UPLOADS=yes`) ومجلد المكتبة. */
  readonly media: { readonly uploads: boolean; readonly root: string | null };
  /** المجلد المطلق لصور العدّة. */
  readonly imagesDir: string;
  /** الروابط الداخلية المعروفة ومنطقة النادي للتحقق كما في نموذج اللوحة. */
  readonly context: (clubId: string) => Promise<SlideContext>;
  readonly now: Date;
}

export interface KitReport {
  readonly clubId: string;
  readonly created: readonly SlideKitId[];
  readonly skipped: readonly SlideKitId[];
}

/** الرفض رسالة جاهزة للطرفية. */
export type KitOutcome = Result<KitReport, string>;

interface Actor {
  readonly root: string;
  readonly clubId: string;
  readonly staffId: string;
  readonly now: Date;
}

async function importImage(
  deps: KitDeps,
  actor: Actor,
  file: string,
): Promise<Result<MediaAsset, string>> {
  const bytes = await readFile(join(deps.imagesDir, file)).catch(() => null);
  if (bytes === null) {
    return err(kitMessage("imageMissing", { file }));
  }
  const uploaded = await uploadImage(deps.db, { ...actor, bytes, fileName: file });
  return uploaded.ok
    ? ok(uploaded.value.asset)
    : err(kitMessage("imageRefused", { file, reason: uploaded.error }));
}

function contentInput(slide: KitSlide, desktop: MediaAsset, mobile: MediaAsset) {
  return {
    desktop,
    mobile,
    decorative: false,
    alt: slide.alt,
    texts: slide.texts,
    link: { kind: "internal", internal: slide.link, external: "", newTab: false },
    clickTarget: "slide",
    active: true,
    startsAt: "",
    endsAt: "",
  };
}

type SlideResult = Result<"created" | "skipped", string>;

async function addSlide(
  deps: KitDeps,
  actor: Actor,
  slide: KitSlide,
  context: SlideContext,
): Promise<SlideResult> {
  const desktop = await importImage(deps, actor, kitImageFile(slide.id, "desktop"));
  if (!desktop.ok) {
    return desktop;
  }
  const mobile = await importImage(deps, actor, kitImageFile(slide.id, "mobile"));
  if (!mobile.ok) {
    return mobile;
  }
  if ((await assetUsage(deps.db, desktop.value.id)).draftSlides.length > 0) {
    return ok("skipped");
  }
  const content = validateSlide(contentInput(slide, desktop.value, mobile.value), context);
  if (!content.ok) {
    const fields = content.error.map((issue) => `${issue.field} ${issue.reason}`).join("، ");
    return err(kitMessage("slideInvalid", { id: slide.id, fields }));
  }
  const who = { clubId: actor.clubId, staffId: actor.staffId, now: actor.now };
  const created = await createSlide(deps.db, {
    ...who,
    actor: staffActor(actor.staffId),
    content: content.value,
  });
  return created.ok
    ? ok("created")
    : err(kitMessage("slideRefused", { id: slide.id, reason: created.error.reason }));
}

async function actorOf(deps: KitDeps): Promise<Result<Actor, string>> {
  const root = deps.media.root;
  if (!deps.media.uploads || root === null) {
    return err(kitMessage("uploadsOff"));
  }
  const clubId = await oldestClubId(deps.db);
  if (clubId === null) {
    return err(kitMessage("noClub"));
  }
  const staffId = await oldestActiveOwnerId(deps.db, clubId);
  if (staffId === null) {
    return err(kitMessage("noOwner"));
  }
  return ok({ root, clubId, staffId, now: deps.now });
}

/** يضيف شرائح العدّة الناقصة إلى مسودة نادي الموقع بترتيبها؛ أول رفض يوقف ويُرجع رسالته. */
export async function runLaunchKit(deps: KitDeps): Promise<KitOutcome> {
  const actor = await actorOf(deps);
  if (!actor.ok) {
    return actor;
  }
  const context = await deps.context(actor.value.clubId);
  const created: SlideKitId[] = [];
  const skipped: SlideKitId[] = [];
  for (const slide of SLIDE_KIT) {
    const result = await addSlide(deps, actor.value, slide, context);
    if (!result.ok) {
      return result;
    }
    (result.value === "created" ? created : skipped).push(slide.id);
  }
  return ok({ clubId: actor.value.clubId, created, skipped });
}
