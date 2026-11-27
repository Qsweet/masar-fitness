import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ABSENT_LOCK_TOKEN,
  createDb,
  DraftConflict,
  listDraftEntries,
  saveDraftEntries,
  staffActor,
  type Db,
  type SaveDraftInput,
} from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { createDbClients, disconnectAll, testDatabaseUrl } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/** مسودة المحتوى (ADMIN_A3_CONTENT §8.2، WP3): الحفظ والقفل المتفائل والسباقات والتدقيق. */
const HASH = "b".repeat(64);
const NOW = new Date("2026-11-28T09:00:00Z");
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

async function setup() {
  const clubId = await createTestClub(db);
  const staff = await createTestStaff(db, clubId, { role: "editor" });
  const base = (changes: SaveDraftInput["changes"]): SaveDraftInput => ({
    clubId,
    staffId: staff.id,
    actor: staffActor(staff.id),
    target: "hero",
    changes,
    now: NOW,
  });
  return { clubId, staffId: staff.id, base };
}

const text = (value: string) => ({ value, baseHash: HASH });

describe("saveDraftEntries", () => {
  it("يحفظ ثم يرفض رمزًا قديمًا، والعودة إلى الافتراضي صف بقيمة NULL", async () => {
    const { clubId, base } = await setup();
    const change = { key: "text:hero.title", locale: "ar", lockToken: ABSENT_LOCK_TOKEN };
    expect(await saveDraftEntries(db, base([{ ...change, value: text("عنوان") }]))).toEqual({
      ok: true,
      value: 1,
    });
    const [saved] = await listDraftEntries(db, clubId);
    expect(saved).toMatchObject({ key: "text:hero.title", locale: "ar", value: text("عنوان") });
    const stale = await saveDraftEntries(db, base([{ ...change, value: text("آخر") }]));
    expect(stale.ok ? null : stale.error).toBeInstanceOf(DraftConflict);
    expect(stale).toMatchObject({ ok: false, error: { stale: ["text:hero.title|ar"] } });
    const reverted = await saveDraftEntries(
      db,
      base([{ ...change, value: null, lockToken: saved?.lockToken ?? "" }]),
    );
    expect(reverted.ok).toBe(true);
    const [after] = await listDraftEntries(db, clubId);
    expect(after?.value).toBeNull();
    expect(Number(after?.lockToken)).toBeGreaterThan(Number(saved?.lockToken));
  });

  it("رمز قديم لمفتاح واحد يرفض الطلب كله ولا يكتب شيئًا منه", async () => {
    const { clubId, base } = await setup();
    await saveDraftEntries(
      db,
      base([{ key: "text:hero.title", locale: "ar", value: text("أ"), lockToken: "" }]),
    );
    const result = await saveDraftEntries(
      db,
      base([
        { key: "text:hero.lead", locale: "ar", value: text("ب"), lockToken: "" },
        { key: "text:hero.title", locale: "ar", value: text("ج"), lockToken: "" },
      ]),
    );
    expect(result.ok).toBe(false);
    expect((await listDraftEntries(db, clubId)).map((row) => row.key)).toEqual(["text:hero.title"]);
  });

  it("تعديلان متزامنان لمفتاحين يمران، ولمفتاح واحد يُرفض أحدهما", async () => {
    const { clubId, base } = await setup();
    const both = await Promise.all([
      saveDraftEntries(
        db,
        base([{ key: "text:hero.title", locale: "ar", value: text("أ"), lockToken: "" }]),
      ),
      saveDraftEntries(
        other,
        base([{ key: "text:hero.lead", locale: "ar", value: text("ب"), lockToken: "" }]),
      ),
    ]);
    expect(both.map((result) => result.ok)).toEqual([true, true]);
    const race = await Promise.all([
      saveDraftEntries(
        db,
        base([{ key: "text:hero.slogan", locale: "en", value: text("x"), lockToken: "" }]),
      ),
      saveDraftEntries(
        other,
        base([{ key: "text:hero.slogan", locale: "en", value: text("y"), lockToken: "" }]),
      ),
    ]);
    expect(race.map((result) => result.ok).sort()).toEqual([false, true]);
    expect((await listDraftEntries(db, clubId)).length).toBe(3);
  });

  it("سطر التدقيق بالمساحة والعدد قيمتين، بلا مسار ولا مفتاح يطابق name", async () => {
    const { clubId, staffId, base } = await setup();
    const input = base([
      { key: "text:club.name", locale: "ar", value: text("اسم"), lockToken: "" },
    ]);
    await saveDraftEntries(db, { ...input, target: "club" });
    const logs = await db.auditLog.findMany({ where: { clubId, action: "content_draft_saved" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      entityType: "content_draft",
      entityId: clubId,
      actor: `staff:${staffId}`,
      data: { target: "club", changedCount: 1 },
    });
    expect(Object.keys(logs[0]?.data ?? {}).some((key) => /phone|mobile|name/i.test(key))).toBe(
      false,
    );
  });

  it("القاعدة ترفض مفتاحًا بغير شكله وقيمة فارغة ولغة مجهولة", async () => {
    const { clubId, staffId } = await setup();
    const insert = (key: string, locale: string, value: string) =>
      db.$executeRaw`INSERT INTO content_draft_entries VALUES (${clubId}::uuid, ${key}, ${locale}, ${value}::jsonb, ${staffId}::uuid, now())`;
    await expect(insert("hero.title", "ar", JSON.stringify(text("x")))).rejects.toThrow(
      "content_draft_entries_key_shape",
    );
    await expect(insert("text:hero.title", "fr", JSON.stringify(text("x")))).rejects.toThrow(
      "content_draft_entries_locale_known",
    );
    await expect(insert("text:hero.title", "ar", JSON.stringify(text("")))).rejects.toThrow(
      "content_draft_entries_value_shape",
    );
  });
});
