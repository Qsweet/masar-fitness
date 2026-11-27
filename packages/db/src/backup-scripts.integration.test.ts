import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { backupHealth, parseBackupRecord, type BackupStatusFile } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { createTestAsset } from "./test-support/media-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/**
 * نسخ ثم استرجاع حقيقيان بسكربتات deploy/backup (docs/BACKUP.md §11): restic الحقيقي على مستودع في
 * مجلد مؤقت، وقاعدة الاختبار مصدرًا، والاسترجاع إلى قاعدة جانبية تُحذف. بيئة `local` في السكربتات
 * تبدّل `docker compose` بأدوات الجهاز نفسها، والمنطق كله واحد. بلا restic أو أدوات PostgreSQL على
 * الجهاز يُتخطى الاختبار باسم يذكر السبب (CI يثبّت restic بإصدار وبصمة مثبّتين).
 */
const SCRIPTS = fileURLToPath(new URL("../../../deploy/backup/", import.meta.url));
const TIMEOUT_MS = 180_000;

function which(command: string): string | null {
  const found = spawnSync("sh", ["-c", `command -v "${command}"`], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.trim() : null;
}

const RESTIC = process.env.RESTIC_BIN ?? which("restic");
const PG_TOOLS = ["psql", "pg_dump", "pg_restore"].every((tool) => which(tool) !== null);
const SKIP_REASON =
  RESTIC === null
    ? "يحتاج restic: ضع مساره في RESTIC_BIN أو في PATH"
    : "يحتاج psql وpg_dump وpg_restore في PATH";
const READY = RESTIC !== null && PG_TOOLS;
/** في CI لا تخطّي: غياب الأدوات فشل (`BACKUP_TESTS_REQUIRED=yes`). */
const REQUIRED = process.env.BACKUP_TESTS_REQUIRED === "yes";

let db: Db;
let work: string;
let env: Record<string, string>;
const url = new URL(testDatabaseUrl());
const databaseName = url.pathname.slice(1);

interface Run {
  readonly status: number | null;
  readonly output: string;
}

function run(script: string, args: readonly string[], extra: Record<string, string> = {}): Run {
  const result = spawnSync("bash", [join(SCRIPTS, script), ...args], {
    env: { ...env, ...extra },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

function restic(args: readonly string[]): string {
  const result = spawnSync(RESTIC ?? "restic", args, { env, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

function snapshotCount(): number {
  return (JSON.parse(restic(["snapshots", "--json"])) as unknown[]).length;
}

function statusText(name: string): string | null {
  try {
    return readFileSync(join(env.BACKUP_STATUS_DIR ?? "", name), "utf8");
  } catch {
    return null;
  }
}

function record(file: BackupStatusFile, name: string) {
  return parseBackupRecord(file, statusText(name));
}

async function scratchDatabases(): Promise<string[]> {
  const rows = await db.$queryRaw<{ name: string }[]>`
    SELECT datname AS name FROM pg_database WHERE datname LIKE ${`${databaseName}_restore_%`}`;
  return rows.map((row) => row.name);
}

/** صورة في القاعدة بملفاتها الحقيقية على قرص الصور، كما يكتبها خط الرفع. */
async function assetWithFiles(clubId: string, staffId: string): Promise<void> {
  const asset = await createTestAsset(db, clubId, staffId);
  const dir = join(env.BACKUP_LOCAL_MEDIA ?? "", clubId, asset.hash);
  mkdirSync(dir, { recursive: true });
  for (const width of asset.widths) {
    writeFileSync(join(dir, `w${String(width)}.avif`), "avif");
    writeFileSync(join(dir, `w${String(width)}.webp`), "webp");
  }
}

beforeAll(async () => {
  work = mkdtempSync(join(tmpdir(), "masar-backup-it-"));
  env = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: work,
    BACKUP_RUNTIME: "local",
    BACKUP_DB_NAME: databaseName,
    BACKUP_LOCAL_STAGE: join(work, "stage"),
    BACKUP_LOCAL_MEDIA: join(work, "media"),
    BACKUP_LOCAL_RESTORE: join(work, "restore"),
    BACKUP_STATUS_DIR: join(work, "status"),
    BACKUP_LOCK_FILE: join(work, "lock"),
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    RESTIC_BIN: RESTIC ?? "",
    RESTIC_REPOSITORY: join(work, "repo"),
    RESTIC_PASSWORD: "integration-test-only",
    RESTIC_HOST: "masar",
    RESTIC_CACHE_DIR: join(work, "cache"),
    APP_VERSION: "it-backup",
  };
  mkdirSync(env.BACKUP_LOCAL_MEDIA ?? "", { recursive: true });
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
  rmSync(work, { recursive: true, force: true });
});

describe.skipIf(!READY)("النسخ الاحتياطي ثم الاسترجاع بسكربتات الخادم", () => {
  it(
    "تهيئة ونسخة ناجحة: سجل الحالة حديث، والبيان بالإصدار والترحيلات",
    { timeout: TIMEOUT_MS },
    async () => {
      const clubId = await createTestClub(db);
      const staff = await createTestStaff(db, clubId);
      await assetWithFiles(clubId, staff.id);

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
        restic(["dump", "latest", join(env.BACKUP_LOCAL_STAGE ?? "", "manifest.json")]),
      ) as { appVersion: string; migrations: string[]; tables: number };
      const applied = await db.$queryRaw<{ name: string }[]>`
      SELECT migration_name AS name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
      expect(manifest.appVersion).toBe("it-backup");
      expect(manifest.migrations).toEqual(applied.map((row) => row.name));
      expect(manifest.tables).toBeGreaterThan(10);
      // النسخة الصريحة لا تبقى بعد الرفع
      expect(() => readFileSync(join(env.BACKUP_LOCAL_STAGE ?? "", "masar.dump"))).toThrow();
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
    const rows = await db.$queryRaw<{ name: string }[]>`
      SELECT datname AS name FROM pg_database WHERE datname LIKE ${`${databaseName}_before_restore_%`}`;
    expect(rows).toEqual([]);
  });

  it("فشل النسخ لا ينشئ لقطة ولا يغيّر آخر نجاح، ويسجّل الخطوة", { timeout: TIMEOUT_MS }, () => {
    const success = statusText("last-success.json");
    const snapshots = snapshotCount();

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

    expect(snapshotCount()).toBe(snapshots);
    expect(statusText("last-success.json")).toBe(success);
  });
});

describe.skipIf(READY)(`النسخ الاحتياطي بسكربتات الخادم: متخطى (${SKIP_REASON})`, () => {
  it("متخطى إلا حيث يُشترط", () => {
    expect(REQUIRED, SKIP_REASON).toBe(false);
  });
});
