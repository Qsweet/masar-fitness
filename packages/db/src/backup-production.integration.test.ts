import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import {
  BACKUP_READY as READY,
  BACKUP_TEST_TIMEOUT_MS as TIMEOUT_MS,
  BackupHarness,
  databasesLike,
  TEST_DATABASE,
} from "./test-support/backup-harness";
import { createTestClub } from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/**
 * الاسترجاع فوق «الإنتاج» (قاعدة الاختبار نفسها) بسكربتات deploy/backup في طرفية حقيقية (`script`)،
 * ومعه اختيار اللقطة الافتراضية وفحص المساحة والترحيلات ورفض التأكيد (docs/BACKUP.md §6، القرار 83).
 * أصل الخلل المصحَّح: نسخة الأمان قبل الاسترجاع كانت تنظّف بـkeep-daily فتحذف لقطة اليوم نفسه التي
 * يُسترجع منها، والسجل أطول من 14 يومًا. التخطي بلا restic كما في `backup-scripts.integration.test.ts`.
 */
const HISTORY_DAYS = 20;
const DAY_MS = 86_400_000;
let db: Db;
let harness: BackupHarness;
let restoredFrom = "";
let clubId = "";
let mediaFile = "";

const previousDatabases = () => databasesLike(db, `${TEST_DATABASE}_before_restore_`);
const scratchDatabases = () => databasesLike(db, `${TEST_DATABASE}_restore_`);
const confirmed = (id: string) => `RESTORE PRODUCTION\n${id.slice(0, 8)}\n`;

/** لقطات يومية بتاريخ مضى على المسارين نفسيهما (مجموعة الاحتفاظ نفسها)، لسجل أطول من 14 يومًا. */
function buildHistory(): void {
  const stage = harness.env.BACKUP_LOCAL_STAGE ?? "";
  mkdirSync(stage, { recursive: true });
  writeFileSync(join(stage, "history.txt"), "old");
  for (let day = HISTORY_DAYS; day >= 1; day -= 1) {
    const time = new Date(Date.now() - day * DAY_MS).toISOString().slice(0, 19).replace("T", " ");
    harness.restic(["backup", "--quiet", "--tag", "masar", "--time", time, stage, harness.media]);
  }
  rmSync(stage, { recursive: true, force: true });
}

beforeAll(async () => {
  harness = new BackupHarness();
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  if (!READY) {
    return;
  }
  clubId = await createTestClub(db);
  const staff = await createTestStaff(db, clubId);
  mediaFile = await harness.assetWithFiles(db, clubId, staff.id);
  expect(harness.run("backup.sh", ["init"]).status).toBe(0);
  buildHistory();
  const backup = harness.run("backup.sh", ["run"]);
  expect(backup.status, backup.output).toBe(0);
  restoredFrom = (harness.record("lastSuccess", "last-success.json") as { snapshot: string })
    .snapshot;
}, TIMEOUT_MS);

afterAll(async () => {
  for (const name of await previousDatabases()) {
    await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}"`);
  }
  await resetCommerceTables(db);
  await db.$disconnect();
  harness.cleanup();
}, TIMEOUT_MS);

describe.skipIf(!READY)("الاسترجاع فوق الإنتاج بسكربتات الخادم", () => {
  it("اللقطة الافتراضية لقطة آخر نجاح لا آخر لقطة", { timeout: TIMEOUT_MS }, () => {
    const other = join(harness.work, "other");
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, "note.txt"), "manual");
    harness.restic(["backup", "--quiet", "--tag", "masar", other]);
    const drill = harness.run("restore.sh", []);
    expect(drill.status, drill.output).toBe(0);
    expect(drill.output).toContain(`اللقطة ${restoredFrom.slice(0, 8)}`);
    expect(harness.record("lastDrill", "last-drill.json")).toMatchObject({
      ok: true,
      snapshot: restoredFrom,
    });
  });

  it("مساحة لا تكفي: رفض قبل إنشاء أي قاعدة", { timeout: TIMEOUT_MS }, async () => {
    const result = harness.run("restore.sh", [], { BACKUP_DUMP_EXPANSION: "100000000000" });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("المساحة الحرة لا تكفي");
    expect(await scratchDatabases()).toEqual([]);
  });

  it("ترحيل في اللقطة لا يعرفه الكود: رفض قبل التأكيد", { timeout: TIMEOUT_MS }, async () => {
    const partial = join(harness.work, "migrations");
    mkdirSync(join(partial, "20261124175743_init_clubs"), { recursive: true });
    const result = harness.runInTerminal(["--production"], "", {
      BACKUP_MIGRATIONS_DIR: partial,
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("لا يعرفها الكود الحالي");
    expect(await previousDatabases()).toEqual([]);
    expect(await scratchDatabases()).toEqual([]);
  });

  it("رفض التأكيد: لا تغيير، والتجربة الجانبية تبقى ناجحة", { timeout: TIMEOUT_MS }, async () => {
    const result = harness.runInTerminal(["--production"], "no\n");
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("لم يُؤكَّد");
    expect(harness.record("lastDrill", "last-drill.json")).toMatchObject({ ok: true });
    expect(await previousDatabases()).toEqual([]);
    expect(await scratchDatabases()).toEqual([]);
  });

  it(
    "لقطة اليوم نفسه مع سجل 20 يومًا: نسخة الأمان لا تحذفها، والقاعدة والصور تعودان",
    { timeout: TIMEOUT_MS },
    async () => {
      const marker = await createTestClub(db);
      unlinkSync(mediaFile);
      const snapshots = harness.snapshotIds();
      expect(snapshots.length).toBeGreaterThan(14);
      await db.$disconnect();

      const result = harness.runInTerminal(["--production"], confirmed(restoredFrom));
      db = createDb(testDatabaseUrl());
      expect(result.status, result.output).toBe(0);
      expect(result.output).toContain("بلا احتفاظ ولا تنظيف");

      const after = harness.snapshotIds();
      expect(after).toContain(restoredFrom);
      expect(after).toHaveLength(snapshots.length + 1);
      expect(await db.club.count({ where: { id: marker } })).toBe(0);
      expect(await db.club.count({ where: { id: clubId } })).toBe(1);
      expect(existsSync(mediaFile)).toBe(true);
      expect(readdirSync(harness.media).some((name) => name.startsWith(".before-restore-"))).toBe(
        true,
      );
      expect(await previousDatabases()).toHaveLength(1);
      expect(await scratchDatabases()).toEqual([]);
      expect(harness.record("lastDrill", "last-drill.json")).toMatchObject({
        ok: true,
        snapshot: restoredFrom,
      });
    },
  );
});
