import "server-only";
import type { BackupAlert } from "@masar/domain";
import { backupStatus } from "../backup/status";
import { getEnv } from "../env";

/**
 * حالة المكتبة في هذا النشر (docs/ADMIN_A3_SLIDER.md §6.4): هل الرفع مفتوح، وهل النسخ الاحتياطي
 * سليم (docs/BACKUP.md §9).
 */
export interface MediaStatus {
  readonly uploads: boolean;
  /** الرفع مفتوح والنسخ الاحتياطي غير سليم: سبب التنبيه الأحمر؛ وإلا null. */
  readonly noBackup: BackupAlert | null;
  /** ساعات منذ آخر نسخة ناجحة، لنص التنبيه. */
  readonly backupAgeHours: number | null;
}

export async function mediaStatus(): Promise<MediaStatus> {
  const env = getEnv();
  const uploads = env.MEDIA_UPLOADS && env.MEDIA_DIR !== null;
  if (!uploads) {
    return { uploads, noBackup: null, backupAgeHours: null };
  }
  const backup = await backupStatus();
  return { uploads, noBackup: backup.alert, backupAgeHours: backup.health.ageHours };
}
