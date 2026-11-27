import type { MediaStatus } from "@/server/media/status";
import type { AdminDictionary } from "@/i18n/admin";
import { backupReason } from "../backup/backup-reason";
import { Alert } from "../ui/kit";

/** حالة الرفع: مطفأ (معلومة)، أو مفتوح والنسخ الاحتياطي غير سليم (تنبيه أحمر لا يُغلق). */
export function MediaBanner({
  status,
  text,
  backupText,
}: {
  readonly status: MediaStatus;
  readonly text: AdminDictionary["media"];
  readonly backupText: AdminDictionary["backup"];
}) {
  if (!status.uploads) {
    return <Alert tone="info">{text.uploadsOff}</Alert>;
  }
  return status.noBackup === null ? null : (
    <div data-testid="no-backup" data-reason={status.noBackup}>
      <Alert tone="danger">
        <span>
          <strong>{text.noBackupTitle}.</strong> {text.noBackup}{" "}
          {backupReason(status.noBackup, status.backupAgeHours, backupText)}
        </span>
      </Alert>
    </div>
  );
}
