import { rmSync } from "node:fs";
import { join } from "node:path";
import { backupHealth } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import {
  BACKUP_READY as READY,
  BACKUP_REQUIRED as REQUIRED,
  BACKUP_SKIP_REASON as SKIP_REASON,
  BACKUP_TEST_TIMEOUT_MS as TIMEOUT_MS,
  BackupHarness,
  databasesLike,
  TEST_DATABASE,
} from "./test-support/backup-harness";
import { createTestClub } from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { createTestAsset } from "./test-support/media-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/**
 * نسخ ثم استرجاع حقيقيان بسكربتات deploy/backup (docs/BACKUP.md §11): restic الحقيقي على مستودع في
 * مجلد مؤقت، وقاعدة الاختبار مصدرًا، والاسترجاع إلى قاعدة جانبية تُحذف. بيئة `local` في السكربتات
 * تبدّل `docker compose` بأدوات الجهاز نفسها، والمنطق كله واحد. بلا restic أو أدوات PostgreSQL على
 * الجهاز يُتخطى الاختبار باسم يذكر السبب (CI يثبّت restic بإصدار وبصمة مثبّتين). الاسترجاع فوق
 * الإنتاج في `backup-production.integration.test.ts`.
 */
let db: Db;
let harness: BackupHarness;
const run = (...args: Parameters<BackupHarness["run"]>) => harness.run(...args);
const record = (...args: Parameters<BackupHarness["record"]>) => harness.record(...args);
const scratchDatabases = () => databasesLike(db, `${TEST_DATABASE}_restore_`);

beforeAll(async () => {
  harness = new BackupHarness();
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
  harness.cleanup();
});

describe.skipIf(!READY)("النسخ الاحتياطي ثم الاسترجاع بسكربتات الخادم", () => {
  it(
    "تهيئة ونسخة ناجحة: سجل الحالة حديث، والبيان بالإصدار والترحيلات",
    { timeout: TIMEOUT_MS },
    async () => {
      const clubId = await createTestClub(db);
      const staff = await createTestStaff(db, clubId);
      await harness.assetWithFiles(db, clubId, staff.id);

      expect(run("backup.sh", ["init"]).status).toBe(0);
      expect(run("backup.sh", ["init"]).status).toBe(0);
      const backup = run("backup.sh", ["run"]);
      expect(backup.status, backup.output).toBe(0);

      const success = record("lastSuccess", "last-success.json");
      expect(success).toMatchObject({ kind: "backup", ok: true });
      expect(record("lastRun", "last-run.json")).toEqual(success);
      const health = backupHealth(
        { lastSuccess: success, lastRun: null, lastCheck: null, lastDrill: null },
        new Date(),
      );
      expect(health.state).toBe("fresh");
      expect(health.repositoryBytes).toBeGreaterThan(0);

      const manifest = JSON.parse(
        harness.restic(["dump", "latest", `${harness.env.BACKUP_LOCAL_STAGE ?? ""}/manifest.json`]),
      ) as { appVersion: string; migrations: string[]; tables: number };
      const applied = await db.$queryRaw<{ name: string }[]>`
      SELECT migration_name AS name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
      expect(manifest.appVersion).toBe("it-backup");
      expect(manifest.migrations).toEqual(applied.map((row) => row.name));
      expect(manifest.tables).toBeGreaterThan(10);
      // النسخة الصريحة لا تبقى بعد الرفع
      expect(harness.statusText("../stage/masar.dump")).toBeNull();
    },
  );

  it("فحص السلامة يكتب سجله", { timeout: TIMEOUT_MS }, () => {
    const check = run("backup.sh", ["check"]);
    expect(check.status, check.output).toBe(0);
    expect(record("lastCheck", "last-check.json")).toMatchObject({ kind: "check", ok: true });
  });

  it(
    "تجربة الاسترجاع: قاعدة جانبية تطابق البيان وملفات الصور موجودة، ثم تُحذف",
    { timeout: TIMEOUT_MS },
    async () => {
      const before = await scratchDatabases();
      const restore = run("restore.sh", []);
      expect(restore.status, restore.output).toBe(0);
      expect(restore.output).toContain("نجح التحقق");
      expect(record("lastDrill", "last-drill.json")).toMatchObject({ kind: "drill", ok: true });
      expect(await scratchDatabases()).toEqual(before);
    },
  );

  it(
    "صورة بلا ملفات في النسخة: التجربة تفشل وتسجّل الفشل، ولا تبقى القاعدة الجانبية",
    { timeout: TIMEOUT_MS },
    async () => {
      const clubId = await createTestClub(db);
      const staff = await createTestStaff(db, clubId);
      await createTestAsset(db, clubId, staff.id);
      expect(run("backup.sh", ["run"]).status).toBe(0);
      const before = await scratchDatabases();
      const restore = run("restore.sh", []);
      expect(restore.status).not.toBe(0);
      expect(restore.output).toContain("غير موجود في النسخة");
      expect(record("lastDrill", "last-drill.json")).toMatchObject({
        ok: false,
        step: "verify_media",
      });
      expect(await scratchDatabases()).toEqual(before);
    },
  );

  it("الاسترجاع فوق الإنتاج يرفض بلا طرفية، ولا يمس القاعدة", { timeout: TIMEOUT_MS }, async () => {
    const before = await scratchDatabases();
    const restore = run("restore.sh", ["--production"]);
    expect(restore.status).not.toBe(0);
    expect(restore.output).toContain("طرفية تفاعلية");
    expect(await scratchDatabases()).toEqual(before);
    expect(await databasesLike(db, `${TEST_DATABASE}_before_restore_`)).toEqual([]);
  });

  it("فشل النسخ لا ينشئ لقطة ولا يغيّر آخر نجاح، ويسجّل الخطوة", { timeout: TIMEOUT_MS }, () => {
    const success = harness.statusText("last-success.json");
    const snapshots = harness.snapshotIds().length;

    const wrongPassword = run("backup.sh", ["run"], { RESTIC_PASSWORD: "not-the-password" });
    expect(wrongPassword.status).not.toBe(0);
    expect(record("lastRun", "last-run.json")).toMatchObject({ ok: false, step: "upload" });

    const noDatabase = run("backup.sh", ["run"], { BACKUP_DB_NAME: "masar_missing_test" });
    expect(noDatabase.status).not.toBe(0);
    expect(record("lastRun", "last-run.json")).toMatchObject({ ok: false, step: "migrations" });

    const unconfigured = run("backup.sh", ["run"], { RESTIC_REPOSITORY: "" });
    expect(unconfigured.status).not.toBe(0);
    expect(unconfigured.output).toContain("RESTIC_REPOSITORY");
    expect(record("lastRun", "last-run.json")).toMatchObject({ ok: false, step: "config" });

    expect(harness.snapshotIds()).toHaveLength(snapshots);
    expect(harness.statusText("last-success.json")).toBe(success);
  });
  it(
    "انتظار قفل ينقضي، أو إيقاف أثناء الانتظار، يُسجَّلان فشلًا لا نجاحًا",
    { timeout: TIMEOUT_MS },
    async () => {
      const success = harness.statusText("last-success.json");
      const holder = harness.holdLock();
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const timedOut = run("backup.sh", ["run"], { BACKUP_LOCK_WAIT_SECONDS: "1" });
        expect(timedOut.status).not.toBe(0);
        expect(record("lastRun", "last-run.json")).toMatchObject({ ok: false, step: "lock" });
        rmSync(join(harness.env.BACKUP_STATUS_DIR ?? "", "last-run.json"));
        const code = await harness.signalled("SIGTERM", 500, {});
        expect(code).toBe(143);
        expect(record("lastRun", "last-run.json")).toMatchObject({ ok: false, step: "lock" });
      } finally {
        holder.kill();
      }
      expect(harness.statusText("last-success.json")).toBe(success);
    },
  );
});

describe.skipIf(READY)(`النسخ الاحتياطي بسكربتات الخادم: متخطى (${SKIP_REASON})`, () => {
  it("متخطى إلا حيث يُشترط", () => {
    expect(REQUIRED, SKIP_REASON).toBe(false);
  });
});
