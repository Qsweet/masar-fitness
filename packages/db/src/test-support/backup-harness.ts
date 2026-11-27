/**
 * تشغيل سكربتات deploy/backup في اختبارات التكامل (docs/BACKUP.md §11): بيئة `local` بأدوات الجهاز
 * وrestic الحقيقي على مستودع في مجلد مؤقت لكل ملف اختبار. لا يُستورد من كود الإنتاج ولا من الفهرس.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBackupRecord, type BackupStatusFile } from "@masar/domain";
import type { Db } from "../client";
import { testDatabaseUrl } from "./commerce-orders";
import { createTestAsset } from "./media-fixtures";

export const BACKUP_TEST_TIMEOUT_MS = 180_000;
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SCRIPTS = join(REPO_ROOT, "deploy/backup");

function which(command: string): string | null {
  const found = spawnSync("sh", ["-c", `command -v "${command}"`], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.trim() : null;
}

const RESTIC = process.env.RESTIC_BIN ?? which("restic");
const TOOLS = ["psql", "pg_dump", "pg_restore", "script", "flock"].every((tool) => which(tool));
export const BACKUP_SKIP_REASON =
  RESTIC === null
    ? "يحتاج restic: ضع مساره في RESTIC_BIN أو في PATH"
    : "يحتاج psql وpg_dump وpg_restore وscript وflock في PATH";
export const BACKUP_READY = RESTIC !== null && TOOLS;
/** في CI لا تخطّي: غياب الأدوات فشل (`BACKUP_TESTS_REQUIRED=yes`). */
export const BACKUP_REQUIRED = process.env.BACKUP_TESTS_REQUIRED === "yes";

export interface Run {
  readonly status: number | null;
  readonly output: string;
}

const url = new URL(testDatabaseUrl());
export const TEST_DATABASE = url.pathname.slice(1);

export class BackupHarness {
  readonly work = mkdtempSync(join(tmpdir(), "masar-backup-it-"));
  readonly env: Readonly<Record<string, string>> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: this.work,
    MASAR_DIR: REPO_ROOT,
    BACKUP_RUNTIME: "local",
    BACKUP_DB_NAME: TEST_DATABASE,
    BACKUP_LOCAL_STAGE: join(this.work, "stage"),
    BACKUP_LOCAL_MEDIA: join(this.work, "media"),
    BACKUP_LOCAL_RESTORE: join(this.work, "restore"),
    BACKUP_STATUS_DIR: join(this.work, "status"),
    BACKUP_LOCK_FILE: join(this.work, "lock"),
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    RESTIC_BIN: RESTIC ?? "",
    RESTIC_REPOSITORY: join(this.work, "repo"),
    RESTIC_PASSWORD: "integration-test-only",
    RESTIC_HOST: "masar",
    RESTIC_CACHE_DIR: join(this.work, "cache"),
    APP_VERSION: "it-backup",
  };

  constructor() {
    mkdirSync(this.media, { recursive: true });
  }

  get media(): string {
    return this.env.BACKUP_LOCAL_MEDIA ?? "";
  }

  run(script: string, args: readonly string[], extra: Record<string, string> = {}): Run {
    const result = spawnSync("bash", [join(SCRIPTS, script), ...args], {
      env: { ...this.env, ...extra },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  }

  /** في طرفية حقيقية (`script`) كما يشغّله المالك، والإجابات على لوحة المفاتيح من `answers`. */
  runInTerminal(args: readonly string[], answers: string, extra: Record<string, string> = {}): Run {
    const command = ["bash", join(SCRIPTS, "restore.sh"), ...args].join(" ");
    const result = spawnSync("script", ["-qec", command, "/dev/null"], {
      env: { ...this.env, ...extra },
      encoding: "utf8",
      input: answers,
    });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  }

  /** يشغّل backup.sh في مجموعة عمليات مستقلة ويرسل الإشارة إليها كلها (كما يفعل systemd). */
  async signalled(signal: NodeJS.Signals, afterMs: number, extra: Record<string, string>) {
    const child = spawn("bash", [join(SCRIPTS, "backup.sh"), "run"], {
      env: { ...this.env, ...extra },
      detached: true,
      stdio: "ignore",
    });
    const pid = child.pid ?? 0;
    setTimeout(() => process.kill(-pid, signal), afterMs);
    return new Promise<number | null>((resolve) => {
      child.on("exit", (code) => {
        resolve(code);
      });
    });
  }

  /** يمسك قفل النسخ من عملية أخرى حتى تُقتل. */
  holdLock() {
    return spawn("flock", [this.env.BACKUP_LOCK_FILE ?? "", "sleep", "60"], { stdio: "ignore" });
  }

  restic(args: readonly string[], extra: Record<string, string> = {}): string {
    const result = spawnSync(RESTIC ?? "restic", args, {
      env: { ...this.env, ...extra },
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`restic ${args.join(" ")}: ${result.stderr}`);
    }
    return result.stdout;
  }

  snapshotIds(): string[] {
    const list = JSON.parse(this.restic(["snapshots", "--json"])) as { id: string }[];
    return list.map((snapshot) => snapshot.id);
  }

  statusText(name: string): string | null {
    try {
      return readFileSync(join(this.env.BACKUP_STATUS_DIR ?? "", name), "utf8");
    } catch {
      return null;
    }
  }

  record(file: BackupStatusFile, name: string) {
    return parseBackupRecord(file, this.statusText(name));
  }

  /** صورة في القاعدة بملفاتها على قرص الصور، كما يكتبها خط الرفع؛ المخرَج مسار أول ملف. */
  async assetWithFiles(db: Db, clubId: string, staffId: string): Promise<string> {
    const asset = await createTestAsset(db, clubId, staffId);
    const dir = join(this.media, clubId, asset.hash);
    mkdirSync(dir, { recursive: true });
    for (const width of asset.widths) {
      writeFileSync(join(dir, `w${String(width)}.avif`), "avif");
      writeFileSync(join(dir, `w${String(width)}.webp`), "webp");
    }
    return join(dir, `w${String(asset.widths[0] ?? 0)}.avif`);
  }

  cleanup(): void {
    rmSync(this.work, { recursive: true, force: true });
  }
}

/** قواعد باسم يبدأ بالبادئة (الجانبية `<db>_restore_*`، والسابقة `<db>_before_restore_*`). */
export async function databasesLike(db: Db, prefix: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ name: string }[]>`
    SELECT datname AS name FROM pg_database WHERE datname LIKE ${`${prefix}%`} ORDER BY 1`;
  return rows.map((row) => row.name);
}
