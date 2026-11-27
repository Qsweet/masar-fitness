import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  loadDraftSlider,
  oldestClubId,
  removeSlide,
  staffActor,
  type Db,
} from "@masar/db";
import {
  createTestClub,
  createTestStaff,
  resetCommerceTables,
  testDatabaseUrl,
} from "@masar/db/test-support";
import type { SlideContext } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { STATIC_PATHS } from "@/config/routes";
import { SLIDE_KIT, SLIDE_KIT_DIR, SLIDE_KIT_IDS } from "@/content/slider-kit/kit";
import { HOME_ANCHORS } from "../content/slider-links";
import { runLaunchKit, type KitDeps } from "./launch-kit";
import { KIT_MESSAGES } from "./messages";

/**
 * عدّة الشريط على قاعدة حقيقية وبخط الصور الحقيقي (docs/SLIDER_KIT.md §4): المسودة وحدها، والتكرار
 * آمن، والرفض بلا علم الرفع أو بلا مالك لا يكتب شيئًا.
 */
const IMAGES = join(import.meta.dirname, "..", "..", "..", SLIDE_KIT_DIR);
const KNOWN = new Set([...STATIC_PATHS, ...HOME_ANCHORS.map((anchor) => `/#${anchor}`)]);
const CONTEXT: SlideContext = { knownPaths: KNOWN, timeZone: "Asia/Riyadh" };
const NOW = new Date("2026-11-27T12:00:00Z");
/** عشر صور تُعاد ترميزًا بـsharp حقيقي في كل تشغيل أول. */
const SLOW = 180_000;
let db: Db;
let root = "";
let clubId = "";

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  root = await mkdtemp(join(tmpdir(), "masar-kit-"));
});

beforeEach(async () => {
  await resetCommerceTables(db);
  // قاعدة الاختبار قبل البذرة بلا نادٍ: نادي اختبار يصير الأقدم
  clubId = (await oldestClubId(db)) ?? (await createTestClub(db));
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
  await rm(root, { recursive: true, force: true });
});

function deps(uploads = true): KitDeps {
  return {
    db,
    media: { uploads, root },
    imagesDir: IMAGES,
    context: () => Promise.resolve(CONTEXT),
    now: NOW,
  };
}

const counts = async () => ({
  slides: await db.contentSlide.count(),
  assets: await db.mediaAsset.count(),
  releases: await db.contentRelease.count(),
});

describe("pnpm slider:launch-kit", () => {
  it("بلا علم الرفع أو بلا مالك: رسالة عربية ولا كتابة", async () => {
    await createTestStaff(db, clubId);
    expect(await runLaunchKit(deps(false))).toEqual({ ok: false, error: KIT_MESSAGES.uploadsOff });
    await resetCommerceTables(db);
    expect(await runLaunchKit(deps())).toEqual({ ok: false, error: KIT_MESSAGES.noOwner });
    expect(await counts()).toEqual({ slides: 0, assets: 0, releases: 0 });
  });

  it(
    "ينشئ الشرائح الخمس في المسودة وحدها بالروابط والنصوص، ثم إعادة التشغيل لا تكرر شيئًا",
    async () => {
      const owner = await createTestStaff(db, clubId);
      const first = await runLaunchKit(deps());
      expect(first).toEqual({
        ok: true,
        value: { clubId, created: [...SLIDE_KIT_IDS], skipped: [] },
      });
      expect(await counts()).toEqual({ slides: 5, assets: 10, releases: 0 });

      const draft = await loadDraftSlider(db, clubId);
      expect(draft.settings).toEqual({ autoplay: true, intervalMs: 7_000 });
      expect(draft.slides.map((slide) => slide.position)).toEqual([0, 1, 2, 3, 4]);
      for (const [index, slide] of draft.slides.entries()) {
        const kit = SLIDE_KIT[index];
        expect(slide.link).toEqual({ kind: "internal", path: kit?.link });
        expect(slide.texts).toEqual(kit?.texts);
        expect(slide.alt).toEqual(kit?.alt);
        expect(slide).toMatchObject({ clickTarget: "slide", active: true, decorative: false });
        expect(slide.mobile).not.toBeNull();
        expect(slide.desktop.width).toBeGreaterThanOrEqual(1_280);
      }
      const rows = await db.contentSlide.findMany({ select: { createdBy: true } });
      expect(new Set(rows.map((row) => row.createdBy))).toEqual(new Set([owner.id]));
      expect(await readdir(join(root, clubId))).toHaveLength(10);

      const again = await runLaunchKit(deps());
      expect(again).toEqual({
        ok: true,
        value: { clubId, created: [], skipped: [...SLIDE_KIT_IDS] },
      });
      expect(await counts()).toEqual({ slides: 5, assets: 10, releases: 0 });
    },
    SLOW,
  );

  it(
    "شريحة أزالها المالك من المسودة تعود وحدها إلى المسودة، والبقية لا تتكرر",
    async () => {
      const owner = await createTestStaff(db, clubId);
      await runLaunchKit(deps());
      const [first] = (await loadDraftSlider(db, clubId)).slides;
      const removed = await removeSlide(db, {
        clubId,
        staffId: owner.id,
        actor: staffActor(owner.id),
        now: NOW,
        id: first?.id ?? "",
        lockToken: first?.lockToken ?? "",
      });
      expect(removed.ok).toBe(true);
      const outcome = await runLaunchKit(deps());
      expect(outcome.ok && outcome.value.created).toEqual(["coaches"]);
      expect(await counts()).toEqual({ slides: 5, assets: 10, releases: 0 });
    },
    SLOW,
  );
});
