import "server-only";
import { backupAlert, backupHealth, type BackupAlert, type BackupHealth } from "@masar/domain";
import { getEnv } from "../env";
import { readBackupRecords } from "./records";

/** حالة النسخ الاحتياطي كما تعرضها اللوحة: الحكم من السجل الآلي، و`BACKUP_CONFIGURED` احتياط قديم. */
export interface BackupStatus {
  readonly health: BackupHealth;
  /** سبب التنبيه الأحمر، أو null. */
  readonly alert: BackupAlert | null;
  /** لا سجل آلي، والإعلان اليدوي القديم مكتوب. */
  readonly declaredManually: boolean;
}

export async function backupStatus(now: Date = new Date()): Promise<BackupStatus> {
  const env = getEnv();
  const health = backupHealth(await readBackupRecords(env.BACKUP_STATUS_DIR), now);
  return {
    health,
    alert: backupAlert(health, env.BACKUP_CONFIGURED),
    declaredManually: health.state === "unmonitored" && env.BACKUP_CONFIGURED,
  };
}
