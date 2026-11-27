import type { ReactNode } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import type { BackupStatus } from "@/server/backup/status";
import { When, type WhenProps } from "../overview/when";
import { Badge, type Tone } from "../ui/kit";

type BackupText = AdminDictionary["backup"];
type Clock = Omit<WhenProps, "at">;

function stateLabel(status: BackupStatus, text: BackupText["system"]): string {
  switch (status.health.state) {
    case "unreadable":
      return text.unreadable;
    case "unmonitored":
      return status.declaredManually ? text.declared : text.unmonitored;
    case "fresh":
    case "stale":
    case "never":
      return text.never;
  }
}

function lastBackup(status: BackupStatus, text: BackupText["system"], clock: Clock) {
  const { health, alert } = status;
  if (health.lastSuccessAt === null) {
    return (
      <Badge tone={status.declaredManually ? "neutral" : "danger"}>
        {stateLabel(status, text)}
      </Badge>
    );
  }
  const tone: Tone = alert !== null ? "danger" : health.lastRunFailed ? "warning" : "success";
  const [before = "", after = ""] = text.lastSuccess.split("{age}");
  return (
    <Badge tone={tone}>
      {before}
      <When at={health.lastSuccessAt} {...clock} />
      {after}
      {health.lastRunFailed ? ` ${text.lastRunFailed}` : null}
      {health.checkFailed ? ` · ${text.checkFailed}` : null}
    </Badge>
  );
}

/** صفّا «حالة النظام» للنسخ الاحتياطي: آخر نسخة ناجحة، وآخر تجربة استرجاع (docs/BACKUP.md §9). */
export function backupRows(
  status: BackupStatus,
  text: BackupText,
  clock: Clock,
): readonly (readonly [string, ReactNode])[] {
  const drill = status.health.lastDrillAt;
  return [
    [
      text.system.label,
      <span key="backup" data-testid="backup-status" data-state={status.health.state}>
        {lastBackup(status, text.system, clock)}
      </span>,
    ],
    [
      text.system.drill,
      <span key="drill" data-testid="backup-drill">
        {drill === null ? text.system.drillNever : <When at={drill} {...clock} />}
      </span>,
    ],
  ];
}
