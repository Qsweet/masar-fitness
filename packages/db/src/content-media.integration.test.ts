import { buildSnapshot, ok, type SliderState } from "@masar/domain";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  createSlide,
  deleteMediaAsset,
  draftSliderState,
  latestRelease,
  listMediaAssets,
  loadDraftSlider,
  publishContent,
  staffActor,
  updateSlide,
  type Db,
} from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { disconnectAll, testDatabaseUrl } from "./test-support/commerce-orders";
import { createTestAsset, testSlideContent } from "./test-support/media-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/** المكتبة والشريط بعد المراجعة (القرار 77): صورة حُذفت، والقائمة المجمَّعة، والتفريغ الآمن. */
const NOW = new Date("2026-11-30T10:00:00Z");
let db: Db;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db]);
});

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const noFiles = () => Promise.resolve();

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
    const slider: SliderState = draftSliderState(await loadDraftSlider(db, clubId));
    const snapshot = buildSnapshot(new Map(), slider);
    const digest = sha(JSON.stringify(snapshot));
    const head = await latestRelease(db, clubId);
    return publishContent(db, {
      ...who,
      expectedDigest: digest,
      expectedLatestId: head?.id ?? null,
      build: () => ok({ snapshot, digest, changedCount: 1, slider }),
    });
  };
  return { clubId, staff, who, asset, addSlide, publish };
}

describe("صورة حُذفت بعد فتح النموذج", () => {
  it("حفظ الشريحة يُرفض بسببه بعد القفل، لا بخطأ FK", async () => {
    const { clubId, staff, who, asset } = await setup();
    const gone = await createTestAsset(db, clubId, staff.id);
    expect(
      (
        await deleteMediaAsset(db, {
          clubId,
          assetId: gone.id,
          actor: who.actor,
          now: NOW,
          removeFiles: noFiles,
        })
      ).ok,
    ).toBe(true);
    expect(await createSlide(db, { ...who, content: testSlideContent(gone) })).toMatchObject({
      ok: false,
      error: { reason: "slider.image_unknown", field: "desktop" },
    });
    const created = await createSlide(db, { ...who, content: testSlideContent(asset) });
    if (!created.ok) {
      throw created.error;
    }
    const token = (await loadDraftSlider(db, clubId)).slides[0]?.lockToken ?? "";
    expect(
      await updateSlide(db, {
        ...who,
        id: created.value,
        lockToken: token,
        changed: ["mobile"],
        content: testSlideContent(asset, { mobile: gone }),
      }),
    ).toMatchObject({ ok: false, error: { reason: "slider.image_unknown", field: "mobile" } });
  });
});

describe("قائمة المكتبة", () => {
  it("بصفحات، والاستعمال في الاستعلام نفسه", async () => {
    const { clubId, staff, addSlide, publish, asset } = await setup();
    await addSlide();
    expect((await publish()).ok).toBe(true);
    const other = await createTestAsset(db, clubId, staff.id);
    const first = await listMediaAssets(db, clubId, { offset: 0, limit: 1 });
    expect(first.total).toBe(2);
    expect(first.items.map((item) => item.id)).toHaveLength(1);
    const all = await listMediaAssets(db, clubId, { offset: 0, limit: 10 });
    const used = all.items.find((item) => item.id === asset.id);
    expect(used?.usage).toEqual({ draftSlides: [0], releases: [1] });
    expect(all.items.find((item) => item.id === other.id)?.usage).toEqual({
      draftSlides: [],
      releases: [],
    });
  });
});

describe("تفريغ قاعدة الاختبار", () => {
  it("يعيد تفعيل محفّزي TRUNCATE بعده دائمًا", async () => {
    await resetCommerceTables(db);
    const rows = await db.$queryRaw<{ tgname: string; tgenabled: string }[]>`
      SELECT tgname::text AS tgname, tgenabled::text AS tgenabled FROM pg_trigger
      WHERE tgname IN ('content_releases_forbid_truncate', 'content_release_media_forbid_truncate')
      ORDER BY tgname`;
    expect(rows).toEqual([
      { tgname: "content_release_media_forbid_truncate", tgenabled: "O" },
      { tgname: "content_releases_forbid_truncate", tgenabled: "O" },
    ]);
  });
});
