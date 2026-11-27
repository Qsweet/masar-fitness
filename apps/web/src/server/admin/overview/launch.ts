import "server-only";
import { countSellableMemberships, getSalesSettings, staffMfaCoverage } from "@masar/db";
import {
  hasPermission,
  LAUNCH_ITEMS,
  launchChecklist,
  liveSlides,
  type LaunchEntry,
  type LaunchInput,
  type LaunchItem,
  type Permission,
  type StaffRole,
} from "@masar/domain";
import { textRegistry } from "../../content/registry";
import { backupStatus } from "../../backup/status";
import { getDb } from "../../db";
import { loadPublished } from "../content/state";
import { systemStatus } from "../system-status";

/**
 * قائمة الإطلاق على الخادم (ADMIN_REDESIGN §5.1): تُقرأ حالة كل بند من مصدره الحقيقي، ويُرى البند بصلاحية
 * فعله فقط (المحرر والمبيعات لا يرون إعدادات البيع ولا النسخ الاحتياطي).
 */
export const LAUNCH_PERMISSIONS: Readonly<Record<LaunchItem, Permission>> = {
  mfa: "staff.manage",
  plans: "catalog.write",
  salesSettings: "sales.settings",
  content: "content.publish",
  slider: "content.write",
  backup: "system.read",
  payments: "system.read",
  checkout: "system.read",
};

async function readLaunchInput(clubId: string, now: Date): Promise<LaunchInput> {
  const db = getDb();
  const [mfa, sellablePlans, settings, published, backup] = await Promise.all([
    staffMfaCoverage(db, clubId),
    countSellableMemberships(db, clubId, now),
    getSalesSettings(db, clubId),
    loadPublished(clubId, textRegistry()),
    backupStatus(now),
  ]);
  const system = systemStatus(mfa, backup);
  return {
    mfa,
    sellablePlans,
    salesSettings: {
      windowDecided: settings.orderPaymentWindowMinutes !== null,
      startDecided: settings.membershipStartRule !== null,
    },
    publishedRelease: published.head !== null,
    liveSlides: liveSlides(published.slider.slides, now).length,
    backup: {
      state: backup.health.state,
      failing: backup.health.lastRunFailed || backup.health.checkFailed,
    },
    payments: system.payments.mode,
    checkout: system.checkout,
  };
}

/** البنود الظاهرة لهذا الدور بحالاتها؛ فارغة حين لا يملك الدور فعل أي بند (فلا تُقرأ الحالة). */
export async function loadLaunchChecklist(
  clubId: string,
  role: StaffRole,
  now: Date,
): Promise<LaunchEntry[]> {
  const visible = (item: LaunchItem) => hasPermission(role, LAUNCH_PERMISSIONS[item]);
  if (!LAUNCH_ITEMS.some(visible)) {
    return [];
  }
  const entries = launchChecklist(await readLaunchInput(clubId, now));
  return entries.filter((entry) => visible(entry.item));
}
