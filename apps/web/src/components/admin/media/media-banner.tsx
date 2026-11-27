import type { MediaStatus } from "@/server/media/status";
import type { AdminDictionary } from "@/i18n/admin";
import { Alert } from "../ui/kit";

/** حالة الرفع: مطفأ (معلومة)، أو مفتوح بلا نسخ احتياطي (تنبيه أحمر لا يُغلق). */
export function MediaBanner({
  status,
  text,
}: {
  readonly status: MediaStatus;
  readonly text: AdminDictionary["media"];
}) {
  if (!status.uploads) {
    return <Alert tone="info">{text.uploadsOff}</Alert>;
  }
  return status.noBackup ? (
    <div data-testid="no-backup">
      <Alert tone="danger">
        <span>
          <strong>{text.noBackupTitle}.</strong> {text.noBackup}
        </span>
      </Alert>
    </div>
  ) : null;
}
