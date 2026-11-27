import "server-only";
import { listAuditLogs, listStaff, type ClubSummary } from "@masar/db";
import { hasPermission, type StaffRole } from "@masar/domain";
import { staffMfaCoverage } from "@masar/db";
import { OVERVIEW_ACTIVITY_ROWS } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { backupStatus } from "../../backup/status";
import { getDb } from "../../db";
import { activityItem, type ActivityItem } from "../overview-view";
import { systemStatus, type SystemStatus } from "../system-status";

/** آخر النشاط لمن يقرأ سجل التدقيق فقط (القرار 64-4)، وإلا null. */
export async function loadActivity(
  club: ClubSummary,
  role: StaffRole,
): Promise<ActivityItem[] | null> {
  if (!hasPermission(role, "audit.read")) {
    return null;
  }
  const db = getDb();
  const [log, members] = await Promise.all([
    listAuditLogs(db, { clubId: club.id, page: 1, pageSize: OVERVIEW_ACTIVITY_ROWS }),
    listStaff(db, club.id),
  ]);
  const names = new Map(members.map((member) => [member.id, member.displayName]));
  const dictionary = getAdminDictionary();
  return log.rows.map((row) => activityItem(row, names, dictionary));
}

/** حالة النظام للمالك والمدير (`system.read`)، وإلا null. */
export async function loadSystem(club: ClubSummary, role: StaffRole): Promise<SystemStatus | null> {
  if (!hasPermission(role, "system.read")) {
    return null;
  }
  const [mfa, backup] = await Promise.all([staffMfaCoverage(getDb(), club.id), backupStatus()]);
  return systemStatus(mfa, backup);
}
