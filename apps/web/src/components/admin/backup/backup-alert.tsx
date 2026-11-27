import type { BackupStatus } from "@/server/backup/status";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { Alert } from "../ui/kit";
import { backupReason } from "./backup-reason";

/** تنبيه أحمر لا يُغلق في «نظرة عامة» ما دام النسخ الاحتياطي غير سليم (docs/BACKUP.md §9). */
export function BackupAlert({
  status,
  text,
}: {
  readonly status: BackupStatus;
  readonly text: AdminDictionary["backup"];
}) {
  if (status.alert === null) {
    return null;
  }
  const reason = backupReason(status.alert, status.health.ageHours, text);
  return (
    <div data-testid="backup-alert" data-reason={status.alert}>
      <Alert tone="danger">
        <span>
          <strong>{text.alertTitle}.</strong> {fill(text.alertBody, { reason })}
        </span>
      </Alert>
    </div>
  );
}
