import "server-only";
import { getEnv } from "../env";

/** حالة المكتبة في هذا النشر (docs/ADMIN_A3_SLIDER.md §6.4): هل الرفع مفتوح، وهل أُعلن نسخ احتياطي. */
export interface MediaStatus {
  readonly uploads: boolean;
  /** الرفع مفتوح ولا نسخة احتياطية معلنة: تنبيه أحمر ظاهر. */
  readonly noBackup: boolean;
}

export function mediaStatus(): MediaStatus {
  const env = getEnv();
  const uploads = env.MEDIA_UPLOADS && env.MEDIA_DIR !== null;
  return { uploads, noBackup: uploads && !env.BACKUP_CONFIGURED };
}
