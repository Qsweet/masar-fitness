import type { BackupRecord, BackupRecordSlot, BackupStatusFile } from "./status";

/** أقصى عمر لآخر نسخة ناجحة قبل التنبيه الأحمر: دورة يومية فاتت ومعها هامش نصف يوم. */
export const BACKUP_MAX_AGE_HOURS = 36;
/** وقت في المستقبل أبعد من هذا خلل في ساعة أحد الطرفين، لا نسخة حديثة. */
export const BACKUP_CLOCK_SKEW_MINUTES = 60;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;

export type BackupRecords = Readonly<Record<BackupStatusFile, BackupRecordSlot>>;

/**
 * - `fresh`: آخر نسخة ناجحة خلال 36 ساعة.
 * - `stale`: آخر نسخة ناجحة أقدم من ذلك.
 * - `never`: في السجل محاولات ولا نجاح.
 * - `unmonitored`: لا سجل أصلًا (النسخ الآلي غير مثبَّت، أو المجلد غير مضبوط).
 * - `unreadable`: ملف في السجل لا يُقرأ، أو وقت نجاح في المستقبل.
 */
export type BackupState = "fresh" | "stale" | "never" | "unmonitored" | "unreadable";

export interface BackupHealth {
  readonly state: BackupState;
  readonly lastSuccessAt: Date | null;
  /** ساعات كاملة منذ آخر نسخة ناجحة، أو null. */
  readonly ageHours: number | null;
  /** آخر دورة فشلت بعد آخر نجاح (يبقى `fresh` حتى ينقضي الحد). */
  readonly lastRunFailed: boolean;
  /** آخر فحص سلامة أسبوعي فشل. */
  readonly checkFailed: boolean;
  /** آخر تجربة استرجاع ناجحة، أو null. */
  readonly lastDrillAt: Date | null;
  /** حجم المستودع المشفر بعد آخر نسخة، أو null. */
  readonly repositoryBytes: number | null;
}

function record(slot: BackupRecordSlot): BackupRecord | null {
  return slot === null || slot === "unreadable" ? null : slot;
}

function successState(success: BackupRecord, now: Date): BackupState {
  const ageMs = now.getTime() - success.finishedAt.getTime();
  if (ageMs < -BACKUP_CLOCK_SKEW_MINUTES * MS_PER_MINUTE) {
    return "unreadable";
  }
  return ageMs <= BACKUP_MAX_AGE_HOURS * MS_PER_HOUR ? "fresh" : "stale";
}

function overallState(records: BackupRecords, now: Date): BackupState {
  const slots = Object.values(records);
  if (slots.includes("unreadable")) {
    return "unreadable";
  }
  const success = record(records.lastSuccess);
  if (success !== null) {
    return successState(success, now);
  }
  return slots.every((slot) => slot === null) ? "unmonitored" : "never";
}

function failedAfter(slot: BackupRecordSlot, since: Date | null): boolean {
  const run = record(slot);
  return run !== null && !run.ok && (since === null || run.finishedAt > since);
}

/** الحكم بحالة النسخ الاحتياطي من سجله في اللحظة `now`. */
export function backupHealth(records: BackupRecords, now: Date): BackupHealth {
  const state = overallState(records, now);
  const success = record(records.lastSuccess);
  const drill = record(records.lastDrill);
  const lastSuccessAt = state === "unreadable" ? null : (success?.finishedAt ?? null);
  return {
    state,
    lastSuccessAt,
    ageHours:
      lastSuccessAt === null
        ? null
        : Math.max(0, Math.floor((now.getTime() - lastSuccessAt.getTime()) / MS_PER_HOUR)),
    lastRunFailed: failedAfter(records.lastRun, lastSuccessAt),
    checkFailed: record(records.lastCheck)?.ok === false,
    lastDrillAt: drill?.ok === true ? drill.finishedAt : null,
    repositoryBytes: success?.repositoryBytes ?? null,
  };
}

/** سبب التنبيه الأحمر، أو null بلا تنبيه. */
export type BackupAlert = Exclude<BackupState, "fresh"> | "check_failed";

/**
 * التنبيه الأحمر: كل حال غير `fresh`، وفحص سلامة فاشل ولو كانت النسخة حديثة. الاستثناء الوحيد للتوافق
 * مع ما قبل السجل الآلي: لا سجل أصلًا و`BACKUP_CONFIGURED=yes` معلن يدويًا ⇒ لا تنبيه.
 */
export function backupAlert(health: BackupHealth, declaredManually: boolean): BackupAlert | null {
  switch (health.state) {
    case "fresh":
      return health.checkFailed ? "check_failed" : null;
    case "unmonitored":
      return declaredManually ? null : "unmonitored";
    case "stale":
    case "never":
    case "unreadable":
      return health.state;
  }
}

/** سجل فارغ: لا ملف في المجلد، أو المجلد غير مضبوط. */
export const EMPTY_BACKUP_RECORDS: BackupRecords = {
  lastSuccess: null,
  lastRun: null,
  lastCheck: null,
  lastDrill: null,
};
