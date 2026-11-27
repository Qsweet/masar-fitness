import { createHash } from "node:crypto";
import {
  buildSnapshot,
  DomainError,
  err,
  ok,
  pathOfKey,
  snapshotShape,
  type LocaleOverrides,
} from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  discardDraft,
  listDraftEntries,
  latestRelease,
  publishContent,
  rollbackContent,
  saveDraftEntries,
  staffActor,
  type Db,
  type DraftRow,
} from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { createDbClients, disconnectAll, testDatabaseUrl } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/** النشر والاسترجاع والتجاهل (ADMIN_A3_CONTENT §8، WP4) على قاعدة حقيقية بسجل مبسَّط في الاختبار. */
const HASH = "c".repeat(64);
const NOW = new Date("2026-11-28T10:00:00Z");
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

function snapshotOf(rows: readonly DraftRow[]) {
  const texts = new Map<string, LocaleOverrides>();
  for (const row of rows) {
    const path = pathOfKey(row.key);
    if (row.value !== null && path !== null && (row.locale === "ar" || row.locale === "en")) {
      texts.set(path, { ...texts.get(path), [row.locale]: row.value });
    }
  }
  return buildSnapshot(texts);
}

const digestOf = (rows: readonly DraftRow[]) =>
  createHash("sha256")
    .update(JSON.stringify(snapshotOf(rows)))
    .digest("hex");

const empty = buildSnapshot(new Map());
const shapeOf = (snapshot: unknown) => JSON.stringify(snapshotShape(snapshot) ?? empty);
const countOf = (from: unknown, to: unknown) => (shapeOf(from) === shapeOf(to) ? 0 : 1);
/** «متغيرة» في الاختبار: لقطة المسودة غير لقطة المنشور (السجل الحقيقي يُختبر في الويب). */
const isDirty = (rows: readonly DraftRow[], published: unknown) =>
  JSON.stringify(snapshotOf(rows)) !== shapeOf(published);
const rebuild = (target: unknown, previous: unknown) => {
  const snapshot = snapshotShape(target) ?? empty;
  const digest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return ok({ snapshot, digest, changedCount: countOf(previous, snapshot) });
};

async function setup() {
  const clubId = await createTestClub(db);
  const staff = await createTestStaff(db, clubId);
  const who = { clubId, staffId: staff.id, actor: staffActor(staff.id), now: NOW };
  const edit = async (path: string, value: string) => {
    const row = (await listDraftEntries(db, clubId)).find((item) => item.key === `text:${path}`);
    const saved = await saveDraftEntries(db, {
      ...who,
      target: path.split(".")[0] ?? "",
      changes: [
        {
          key: `text:${path}`,
          locale: "ar",
          value: { value, baseHash: HASH },
          lockToken: row?.lockToken ?? "",
        },
      ],
    });
    expect(saved.ok).toBe(true);
  };
  const publish = async (client: Db = db) => {
    const rows = await listDraftEntries(client, clubId);
    const head = await latestRelease(client, clubId);
    return publishContent(client, {
      ...who,
      expectedDigest: digestOf(rows),
      expectedLatestId: head?.id ?? null,
      build: (current, previous) => {
        const snapshot = snapshotOf(current);
        return ok({
          snapshot,
          digest: digestOf(current),
          changedCount: countOf(previous, snapshot),
        });
      },
    });
  };
  return { clubId, who, edit, publish };
}

describe("publishContent", () => {
  it("ينشر إصدارًا برقمه وسطر تدقيقه، ولا تغيير ⇒ لا نشر", async () => {
    const { clubId, edit, publish } = await setup();
    await edit("hero.title", "أول");
    const first = await publish();
    expect(first).toMatchObject({ ok: true, value: { seq: 1 } });
    expect(await publish()).toMatchObject({
      ok: false,
      error: { reason: "content.nothing_to_publish" },
    });
    const logs = await db.auditLog.findMany({ where: { clubId, action: "content_published" } });
    expect(logs[0]?.data).toMatchObject({ seq: 1, changedCount: 1 });
  });

  it("المسودة تتغير بعد المراجعة ⇒ content.draft_changed، ولا إصدار", async () => {
    const { clubId, who, edit } = await setup();
    await edit("hero.title", "أ");
    const reviewed = digestOf(await listDraftEntries(db, clubId));
    await edit("hero.title", "ب");
    const result = await publishContent(db, {
      ...who,
      expectedDigest: reviewed,
      expectedLatestId: null,
      build: (rows) => ok({ snapshot: snapshotOf(rows), digest: digestOf(rows), changedCount: 1 }),
    });
    expect(result).toMatchObject({ ok: false, error: { reason: "content.draft_changed" } });
    expect(await latestRelease(db, clubId)).toBeNull();
  });

  it("نشران متزامنان: أرقام متتالية بلا تكرار، أو رفض الثاني لأن الأول سبقه", async () => {
    const { clubId, edit, publish } = await setup();
    await edit("hero.title", "متزامن");
    const results = await Promise.all([publish(db), publish(other)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    await edit("hero.lead", "ثانٍ");
    await edit("hero.slogan", "ثالث");
    const both = await Promise.all([publish(db), publish(other)]);
    expect(both.filter((result) => result.ok)).toHaveLength(1);
    const seqs = (
      await db.contentRelease.findMany({ where: { clubId }, orderBy: { seq: "asc" } })
    ).map((row) => row.seq);
    expect(seqs).toEqual([1, 2]);
  });
});

describe("رفض الاسترجاع والتجاهل بلا أثر", () => {
  it("استرجاع لا يغيّر شيئًا، ولقطة لا تمر بالتحقق الحالي، وتجاهل مسودة نظيفة: كلها مرفوضة", async () => {
    const { clubId, who, edit, publish } = await setup();
    await edit("hero.title", "واحد");
    const first = await publish();
    await edit("hero.lead", "ثانٍ");
    const second = await publish();
    await edit("hero.lead", "ثالث");
    const third = await publish();
    if (!first.ok || !second.ok || !third.ok) {
      throw new Error("setup");
    }
    // الإصدار الثاني والثالث يختلفان؛ نعيد الثالث إلى نصوص الثاني ثم نطلب الثاني ثانية: لا تغيير
    await edit("hero.lead", "ثانٍ");
    const fourth = await publish();
    if (!fourth.ok) {
      throw new Error("setup");
    }
    const base = { ...who, expectedLatestId: fourth.value.id, isDirty, rebuild };
    expect(await rollbackContent(db, { ...base, releaseId: second.value.id })).toMatchObject({
      ok: false,
      error: { reason: "content.nothing_to_rollback" },
    });
    const refused = await rollbackContent(db, {
      ...base,
      releaseId: first.value.id,
      rebuild: () => err(new DomainError("validation", "content.draft_invalid")),
    });
    expect(refused).toMatchObject({ ok: false, error: { reason: "content.draft_invalid" } });
    const clean = digestOf(await listDraftEntries(db, clubId));
    expect(
      await discardDraft(db, {
        ...who,
        expectedDraftDigest: clean,
        draftDigest: digestOf,
        isDirty,
      }),
    ).toMatchObject({ ok: false, error: { reason: "content.nothing_to_discard" } });
    expect(await db.contentRelease.count({ where: { clubId } })).toBe(4);
  });
});

describe("rollbackContent و discardDraft", () => {
  it("الاسترجاع مرفوض والمسودة متغيرة، ثم إصدار جديد بلقطة القديم والمسودة تُستبدل بها", async () => {
    const { clubId, who, edit, publish } = await setup();
    await edit("hero.title", "الأول");
    const first = await publish();
    await edit("hero.title", "الثاني");
    const second = await publish();
    if (!first.ok || !second.ok) {
      throw new Error("setup");
    }
    await edit("hero.lead", "غير منشور");
    const input = {
      ...who,
      releaseId: first.value.id,
      expectedLatestId: second.value.id,
      isDirty,
      rebuild,
    };
    expect(await rollbackContent(db, input)).toMatchObject({
      ok: false,
      error: { reason: "content.rollback_draft_dirty" },
    });

    const dirty = digestOf(await listDraftEntries(db, clubId));
    expect(
      await discardDraft(db, {
        ...who,
        expectedDraftDigest: dirty,
        draftDigest: digestOf,
        isDirty,
      }),
    ).toMatchObject({ ok: true });
    expect((await listDraftEntries(db, clubId)).map((row) => row.value?.value)).toEqual(["الثاني"]);

    const rolled = await rollbackContent(db, input);
    expect(rolled).toMatchObject({ ok: true, value: { seq: 3 } });
    const release = await db.contentRelease.findFirst({ where: { clubId, seq: 3 } });
    expect(release).toMatchObject({ source: "rollback", rolledBackFrom: first.value.id });
    expect((await listDraftEntries(db, clubId)).map((row) => row.value?.value)).toEqual(["الأول"]);
    const logs = await db.auditLog.findMany({ where: { clubId, action: "content_rolled_back" } });
    expect(logs[0]?.data).toEqual({ seq: 3, fromSeq: 1 });
    expect(
      await rollbackContent(db, { ...input, expectedLatestId: second.value.id }),
    ).toMatchObject({
      ok: false,
      error: { reason: "content.draft_changed" },
    });
  });

  it("التجاهل بمسودة تغيّرت بعد المراجعة مرفوض", async () => {
    const { who, edit } = await setup();
    await edit("hero.title", "أ");
    const result = await discardDraft(db, {
      ...who,
      expectedDraftDigest: "x",
      draftDigest: digestOf,
      isDirty,
    });
    expect(result).toMatchObject({ ok: false, error: { reason: "content.draft_changed" } });
  });
});
