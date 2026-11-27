import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BACKUP_STATUS_FILES,
  EMPTY_BACKUP_RECORDS,
  parseBackupRecord,
  type BackupRecords,
  type BackupRecordSlot,
  type BackupStatusFile,
} from "@masar/domain";

/** ملف السجل سطر JSON واحد؛ ما زاد على هذا ليس من كتابة backup.sh. */
const MAX_RECORD_BYTES = 4096;

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readSlot(dir: string, file: BackupStatusFile): Promise<BackupRecordSlot> {
  let text: string;
  try {
    text = await readFile(join(dir, BACKUP_STATUS_FILES[file]), "utf8");
  } catch (error) {
    // غياب الملف (أو المجلد) سجل فارغ؛ أي خطأ آخر (صلاحيات، مجلد مكان ملف) لا يُقرأ
    return isMissing(error) ? null : "unreadable";
  }
  return Buffer.byteLength(text) > MAX_RECORD_BYTES ? "unreadable" : parseBackupRecord(file, text);
}

/** يقرأ ملفات السجل الأربعة من مجلده (docs/BACKUP.md §9). بلا مجلد مضبوط: سجل فارغ. */
export async function readBackupRecords(dir: string | null): Promise<BackupRecords> {
  if (dir === null) {
    return EMPTY_BACKUP_RECORDS;
  }
  const [lastSuccess, lastRun, lastCheck, lastDrill] = await Promise.all([
    readSlot(dir, "lastSuccess"),
    readSlot(dir, "lastRun"),
    readSlot(dir, "lastCheck"),
    readSlot(dir, "lastDrill"),
  ]);
  return { lastSuccess, lastRun, lastCheck, lastDrill };
}
