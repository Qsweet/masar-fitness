import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_BACKUP_RECORDS } from "@masar/domain";
import { readBackupRecords } from "./records";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "masar-backup-status-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const success = JSON.stringify({
  format: 1,
  kind: "backup",
  ok: true,
  finishedAt: "2026-11-27T03:12:00Z",
  snapshot: "c".repeat(64),
  bytesProcessed: 1,
  bytesAdded: 1,
  repositoryBytes: 10,
  appVersion: "dev",
});

describe("readBackupRecords: سجل النسخ من مجلده", () => {
  it("بلا مجلد مضبوط، أو مجلد غائب أو فارغ: سجل فارغ", async () => {
    expect(await readBackupRecords(null)).toEqual(EMPTY_BACKUP_RECORDS);
    expect(await readBackupRecords(join(dir, "missing"))).toEqual(EMPTY_BACKUP_RECORDS);
    expect(await readBackupRecords(dir)).toEqual(EMPTY_BACKUP_RECORDS);
  });

  it("يقرأ الملفات الموجودة، والتالف أو الكبير أو مجلد مكان ملف unreadable", async () => {
    await writeFile(join(dir, "last-success.json"), `${success}\n`);
    await writeFile(join(dir, "last-run.json"), "{broken");
    await writeFile(join(dir, "last-check.json"), " ".repeat(5000));
    await mkdir(join(dir, "last-drill.json"));
    const records = await readBackupRecords(dir);
    expect(records.lastSuccess).toMatchObject({ ok: true, snapshot: "c".repeat(64) });
    expect(records.lastRun).toBe("unreadable");
    expect(records.lastCheck).toBe("unreadable");
    expect(records.lastDrill).toBe("unreadable");
  });
});
