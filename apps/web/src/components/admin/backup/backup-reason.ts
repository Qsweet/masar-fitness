import { BACKUP_MAX_AGE_HOURS, type BackupAlert } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { formatHoursAgo } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";

/** جملة سبب التنبيه، بعمر آخر نسخة ناجحة حين يكون السبب قدمها. */
export function backupReason(
  alert: BackupAlert,
  ageHours: number | null,
  text: AdminDictionary["backup"],
): string {
  return fill(text.reasons[alert], {
    age: ageHours === null ? "" : formatHoursAgo(ageHours),
    max: String(BACKUP_MAX_AGE_HOURS),
  });
}
