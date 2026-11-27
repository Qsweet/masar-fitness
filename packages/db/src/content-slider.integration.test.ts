import { createHash } from "node:crypto";
import { buildSnapshot, ok, snapshotSlider, type SliderState } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  createMediaAsset,
  createSlide,
  deleteMediaAsset,
  discardDraft,
  draftSliderState,
  findRelease,
  latestRelease,
  loadDraftSlider,
  moveSlideInDraft,
  publishContent,
  removeSlide,
  rollbackContent,
  saveSliderSettings,
  staffActor,
  updateSlide,
  type Db,
} from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { createDbClients, disconnectAll, testDatabaseUrl } from "./test-support/commerce-orders";
import { createTestAsset, testSlideContent } from "./test-support/media-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/** الشريط والمكتبة على قاعدة حقيقية (ADMIN_A3_SLIDER §6–§7، §12): القيود والحذف والنشر والقفل. */
const NOW = new Date("2026-11-29T10:00:00Z");
let db: Db;
let other: Db;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const snapshotFor = (slider: SliderState) => buildSnapshot(new Map(), slider);
const sliderJsonOf = (snapshot: unknown) => JSON.stringify(snapshotSlider(snapshot).slider);
const build = (_rows: unknown, previous: unknown, slider: SliderState) => {
  const snapshot = snapshotFor(slider);
  const changed = sliderJsonOf(previous) === sliderJsonOf(snapshot) ? 0 : 1;
  return ok({ snapshot, digest: sha(JSON.stringify(snapshot)), changedCount: changed, slider });
};
const isDirty = (_rows: unknown, published: unknown, slider: SliderState) =>
  sliderJsonOf(published) !== JSON.stringify(slider);

async function setup() {
  const clubId = await createTestClub(db);
  const staff = await createTestStaff(db, clubId);
  const who = { clubId, staffId: staff.id, actor: staffActor(staff.id), now: NOW };
  const asset = await createTestAsset(db, clubId, staff.id);
  const addSlide = async () => {
    const created = await createSlide(db, { ...who, content: testSlideContent(asset) });
    if (!created.ok) {
      throw created.error;
    }
    return created.value;
  };
  const publish = async () => {
    const slider = draftSliderState(await loadDraftSlider(db, clubId));
    const head = await latestRelease(db, clubId);
    return publishContent(db, {
      ...who,
      expectedDigest: sha(JSON.stringify(snapshotFor(slider))),
      expectedLatestId: head?.id ?? null,
      build,
    });
  };
  return { clubId, staff, who, asset, addSlide, publish };
}

const noFiles = () => Promise.resolve();
const raw = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: unknown) => String(error),
  );

describe("قيود القاعدة", () => {
  it("C2: الأصل لا يتغير، وC3: ربط الإصدار بأصوله للإلحاق فقط", async () => {
    const { asset, addSlide, publish } = await setup();
    expect(
      await raw(db.$executeRaw`UPDATE media_assets SET width = 1 WHERE id = ${asset.id}::uuid`),
    ).toContain("media_asset_immutable");
    await addSlide();
    const published = await publish();
    expect(published.ok).toBe(true);
    expect(
      await raw(
        db.$executeRaw`DELETE FROM content_release_media WHERE asset_id = ${asset.id}::uuid`,
      ),
    ).toContain("content_release_media_immutable");
    expect(await raw(db.$executeRaw`TRUNCATE content_release_media`)).toContain(
      "content_release_media_immutable",
    );
    expect(await db.contentReleaseMedia.count({ where: { assetId: asset.id } })).toBe(1);
  });

  it("CHECK يرفض رابطًا بغير https وزرًا بلا رابط", async () => {
    const { addSlide } = await setup();
    const id = await addSlide();
    expect(
      await raw(db.$executeRaw`
        UPDATE content_slides SET link_kind = 'external', link_target = 'javascript:alert(1)'
        WHERE id = ${id}::uuid`),
    ).toContain("content_slides_link_shape");
    for (const target of ["/\\evil.com", "/%5cevil.com", "//evil.com", "/Upper"]) {
      expect(
        await raw(db.$executeRaw`
          UPDATE content_slides SET link_kind = 'internal', link_target = ${target}
          WHERE id = ${id}::uuid`),
        target,
      ).toContain("content_slides_link_shape");
    }
    expect(
      await raw(db.$executeRaw`UPDATE content_slides SET cta_ar = 'اشترك' WHERE id = ${id}::uuid`),
    ).toContain("content_slides_cta_needs_link");
  });
});

describe("المكتبة", () => {
  it("الصورة المكررة ترجع الأصل القائم بلا صف ثانٍ، وتمر بضمان ملفاتها", async () => {
    const { clubId, staff, asset } = await setup();
    const ensured: (string | null)[] = [];
    const again = await createMediaAsset(
      db,
      {
        clubId,
        staffId: staff.id,
        actor: staffActor(staff.id),
        sha256: asset.hash,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        variantWidths: asset.widths,
        blurDataUrl: asset.blur,
        dominantColor: asset.color,
        originalName: "again.jpg",
        now: NOW,
      },
      (existing) => {
        ensured.push(existing?.id ?? null);
        return Promise.resolve();
      },
    );
    // الملفات تُضمن للأصل القائم أيضًا (إصلاح ملفات ناقصة)
    expect(again).toMatchObject({ existing: true, asset: { id: asset.id } });
    expect(ensured).toEqual([asset.id]);
    expect(await db.mediaAsset.count({ where: { clubId } })).toBe(1);
  });

  it("حذف صورة تستعملها شريحة مسودة أو إصدار مرفوض، والقاعدة نفسها تمنعه", async () => {
    const { clubId, who, asset, addSlide, publish } = await setup();
    const id = await addSlide();
    const input = { clubId, assetId: asset.id, actor: who.actor, now: NOW, removeFiles: noFiles };
    expect(await deleteMediaAsset(db, input)).toMatchObject({
      ok: false,
      error: { reason: "media.in_use" },
    });
    expect(
      await raw(db.$executeRaw`DELETE FROM media_assets WHERE id = ${asset.id}::uuid`),
    ).toContain("content_slides_desktop_asset_id_fkey");
    expect((await publish()).ok).toBe(true);
    const slide = (await loadDraftSlider(db, clubId)).slides[0];
    expect((await removeSlide(db, { ...who, id, lockToken: slide?.lockToken ?? "" })).ok).toBe(
      true,
    );
    // لم تعد في المسودة لكنها في إصدار: لا تُحذف أبدًا
    expect(await deleteMediaAsset(db, input)).toMatchObject({
      ok: false,
      error: { reason: "media.in_use" },
    });
    expect(
      await raw(db.$executeRaw`DELETE FROM media_assets WHERE id = ${asset.id}::uuid`),
    ).toContain("content_release_media_asset_id_fkey");
  });

  it("صورة لا يستعملها شيء تُحذف بسطر تدقيق", async () => {
    const { clubId, staff, who } = await setup();
    const unused = await createTestAsset(db, clubId, staff.id);
    const removed: string[] = [];
    const result = await deleteMediaAsset(db, {
      clubId,
      assetId: unused.id,
      actor: who.actor,
      now: NOW,
      removeFiles: (gone) => {
        removed.push(gone.id);
        return Promise.resolve();
      },
    });
    expect(removed).toEqual([unused.id]);
    expect(result.ok).toBe(true);
    expect(await db.mediaAsset.count({ where: { id: unused.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { clubId, action: "media_asset_deleted" } })).toBe(1);
  });
});

describe("المسودة: القفل والترتيب", () => {
  it("رمز قديم مرفوض، وتعديلان متزامنان بالرمز نفسه يمر أحدهما", async () => {
    const { clubId, who, asset, addSlide } = await setup();
    const id = await addSlide();
    const token = (await loadDraftSlider(db, clubId)).slides[0]?.lockToken ?? "";
    const edit = (client: Db, title: string) =>
      updateSlide(client, {
        ...who,
        id,
        lockToken: token,
        changed: ["texts"],
        content: testSlideContent(asset, {
          texts: {
            ar: { eyebrow: "", title, subtitle: "", cta: "" },
            en: { eyebrow: "", title: "Title", subtitle: "", cta: "" },
          },
        }),
      });
    const results = await Promise.all([edit(db, "أول"), edit(other, "ثانٍ")]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({
      error: { reason: "slider.stale_edit" },
    });
    expect(await edit(db, "ثالث")).toMatchObject({
      ok: false,
      error: { reason: "slider.stale_edit" },
    });
  });

  it("تحريكات متزامنة تبقي الترتيب كثيفًا بلا تكرار", async () => {
    const { clubId, who, addSlide } = await setup();
    const ids = [await addSlide(), await addSlide(), await addSlide()];
    await Promise.all([
      moveSlideInDraft(db, { ...who, id: ids[2] ?? "", direction: "up" }),
      moveSlideInDraft(other, { ...who, id: ids[0] ?? "", direction: "down" }),
      moveSlideInDraft(db, { ...who, id: ids[1] ?? "", direction: "up" }),
    ]);
    const positions = (await loadDraftSlider(db, clubId)).slides.map((slide) => slide.position);
    expect(positions).toEqual([0, 1, 2]);
    expect(
      await moveSlideInDraft(db, {
        ...who,
        id: "00000000-0000-4000-8000-000000000000",
        direction: "up",
      }),
    ).toMatchObject({
      ok: false,
      error: { reason: "slider.not_found" },
    });
  });

  it("الإعدادات بقفلها المتفائل", async () => {
    const { clubId, who } = await setup();
    const settings = { autoplay: false, intervalMs: 9000 };
    const first = await saveSliderSettings(db, { ...who, settings, lockToken: "" });
    expect(first.ok).toBe(true);
    expect(await saveSliderSettings(db, { ...who, settings, lockToken: "" })).toMatchObject({
      ok: false,
      error: { reason: "slider.stale_edit" },
    });
    expect((await loadDraftSlider(db, clubId)).settings).toEqual(settings);
  });
});

describe("النشر والاسترجاع والتجاهل بالشريط", () => {
  it("الإصدار يحمل الشريط وأصوله، والاسترجاع والتجاهل يعيدان شرائح المسودة", async () => {
    const { clubId, who, asset, addSlide, publish } = await setup();
    const firstSlide = await addSlide();
    const first = await publish();
    const secondSlide = await addSlide();
    const second = await publish();
    if (!first.ok || !second.ok) {
      throw new Error("setup");
    }
    const release = await findRelease(db, clubId, second.value.id);
    expect(snapshotSlider(release?.snapshot).slider.slides.map((slide) => slide.id)).toEqual([
      firstSlide,
      secondSlide,
    ]);
    expect(await db.contentReleaseMedia.count({ where: { releaseId: second.value.id } })).toBe(1);

    // مسودة متغيرة: الاسترجاع مرفوض، ثم التجاهل يعيدها إلى المنشور
    const settings = { autoplay: false, intervalMs: 5000 };
    expect((await saveSliderSettings(db, { ...who, settings, lockToken: "" })).ok).toBe(true);
    const rollback = {
      ...who,
      releaseId: first.value.id,
      expectedLatestId: second.value.id,
      isDirty,
      rebuild: (target: unknown, previous: unknown) =>
        build(null, previous, snapshotSlider(target).slider),
    };
    expect(await rollbackContent(db, rollback)).toMatchObject({
      ok: false,
      error: { reason: "content.rollback_draft_dirty" },
    });
    const draft = draftSliderState(await loadDraftSlider(db, clubId));
    const discarded = await discardDraft(db, {
      ...who,
      expectedDraftDigest: sha(JSON.stringify(snapshotFor(draft))),
      draftDigest: (_rows, slider) => sha(JSON.stringify(snapshotFor(slider))),
      isDirty,
    });
    expect(discarded.ok).toBe(true);
    expect((await loadDraftSlider(db, clubId)).settings.autoplay).toBe(true);

    const rolled = await rollbackContent(db, rollback);
    expect(rolled).toMatchObject({ ok: true, value: { seq: 3 } });
    const restored = await loadDraftSlider(db, clubId);
    expect(restored.slides.map((slide) => slide.id)).toEqual([firstSlide]);
    expect(restored.slides[0]?.desktop.id).toBe(asset.id);
  });
});
