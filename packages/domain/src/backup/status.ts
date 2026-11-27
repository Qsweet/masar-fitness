/**
 * سجل النسخ الاحتياطي الآلي (docs/BACKUP.md §9): ملفات JSON صغيرة يكتبها deploy/backup/backup.sh
 * وrestore.sh، ويقرؤها الموقع للقراءة فقط. هنا شكلها وحدها، والحكم بحداثة النسخ في `health.ts`.
 */

/** صيغة الملفات؛ صيغة أخرى تُعامل كسجل لا يُقرأ. */
export const BACKUP_STATUS_FORMAT = 1;

export const BACKUP_STATUS_FILES = {
  lastSuccess: "last-success.json",
  lastRun: "last-run.json",
  lastCheck: "last-check.json",
  lastDrill: "last-drill.json",
} as const;

export type BackupStatusFile = keyof typeof BACKUP_STATUS_FILES;
export type BackupRecordKind = "backup" | "check" | "drill";

export interface BackupRecord {
  readonly kind: BackupRecordKind;
  readonly ok: boolean;
  readonly finishedAt: Date;
  /** المعرّف الكامل للقطة (نجاح النسخ والتجربة)، أو null. */
  readonly snapshot: string | null;
  /** الخطوة التي فشلت (فشل فقط)، أو null. */
  readonly step: string | null;
  /** حجم المستودع المشفر بالبايت بعد التنظيف (نجاح النسخ فقط)، أو null. */
  readonly repositoryBytes: number | null;
}

/** ملف غائب = null؛ ملف موجود لا يُقرأ = "unreadable". */
export type BackupRecordSlot = BackupRecord | null | "unreadable";

const KINDS: readonly BackupRecordKind[] = ["backup", "check", "drill"];
const EXPECTED_KIND: Readonly<Record<BackupStatusFile, BackupRecordKind>> = {
  lastSuccess: "backup",
  lastRun: "backup",
  lastCheck: "check",
  lastDrill: "drill",
};
const SNAPSHOT_ID = /^[0-9a-f]{64}$/;
const STEP = /^[a-z_]{1,40}$/;
/** الوقت كما يكتبه `date -u +%Y-%m-%dT%H:%M:%SZ`. */
const UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, shape: RegExp): string | null | undefined {
  if (value === undefined) {
    return null;
  }
  return typeof value === "string" && shape.test(value) ? value : undefined;
}

function optionalCount(value: unknown): number | null | undefined {
  if (value === undefined) {
    return null;
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function parseInstant(value: unknown): Date | undefined {
  if (typeof value !== "string" || !UTC_SECONDS.test(value)) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseKind(value: unknown): BackupRecordKind | undefined {
  return KINDS.find((kind) => kind === value);
}

function parseFields(raw: Record<string, unknown>): BackupRecord | undefined {
  const kind = parseKind(raw.kind);
  const finishedAt = parseInstant(raw.finishedAt);
  const snapshot = optionalString(raw.snapshot, SNAPSHOT_ID);
  const step = optionalString(raw.step, STEP);
  const repositoryBytes = optionalCount(raw.repositoryBytes);
  if (
    raw.format !== BACKUP_STATUS_FORMAT ||
    kind === undefined ||
    typeof raw.ok !== "boolean" ||
    finishedAt === undefined ||
    snapshot === undefined ||
    step === undefined ||
    repositoryBytes === undefined
  ) {
    return undefined;
  }
  return { kind, ok: raw.ok, finishedAt, snapshot, step, repositoryBytes };
}

/**
 * يقرأ نص ملف من السجل. null للنص الغائب (لا ملف)، و"unreadable" لما لا يطابق الشكل أو النوع المتوقع
 * للملف (سجل نجاح يقول فشلًا مثلًا): لا يُبنى عليه حكم بأن النسخ سليم.
 */
export function parseBackupRecord(file: BackupStatusFile, text: string | null): BackupRecordSlot {
  if (text === null) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return "unreadable";
  }
  const record = isRecordObject(raw) ? parseFields(raw) : undefined;
  if (record?.kind !== EXPECTED_KIND[file]) {
    return "unreadable";
  }
  if (file === "lastSuccess" && (!record.ok || record.snapshot === null)) {
    return "unreadable";
  }
  return record;
}
