import "server-only";
import { countSellableMemberships, getSalesSettings } from "@masar/db";
import {
  hasPermission,
  LAUNCH_ITEMS,
  launchChecklist,
  liveSlides,
  type LaunchInput,
  type LaunchItem,
  type Permission,
  type StaffRole,
} from "@masar/domain";
import { cache } from "react";
import { textRegistry } from "../../content/registry";
import { getDb } from "../../db";
import { clubMfaCoverage, currentBackupStatus } from "../cached-reads";
import { loadPublished } from "../content/state";
import { systemStatus } from "../system-status";
import type { LaunchView } from "./launch-view";

/**
 * قائمة الإطلاق على الخادم (ADMIN_REDESIGN §5.1): كل بند من مصدره الحقيقي، والملخص على البنود الثمانية
 * كلها (فلا يرى المدير «اكتمل» والخطوتان ناقصتان). البطاقة لمن يقرأ حالة النظام (المالك والمدير،
 * القرار 64-4)، والدور يقرر أي بند له زر عنده؛ ما لا يفعله الموظف يُعلَّم «بيد المالك».
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
    clubMfaCoverage(clubId),
    countSellableMemberships(db, clubId, now),
    getSalesSettings(db, clubId),
    loadPublished(clubId, textRegistry()),
    currentBackupStatus(),
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

/** البنود الثمانية بحالاتها وما يفعله هذا الدور منها، أو null لمن لا يقرأ حالة النظام. مرة لكل طلب. */
export const loadLaunch = cache(
  async (clubId: string, role: StaffRole): Promise<LaunchView | null> => {
    if (!hasPermission(role, "system.read")) {
      return null;
    }
    const input = await readLaunchInput(clubId, new Date());
    return {
      entries: launchChecklist(input),
      actionable: LAUNCH_ITEMS.filter((item) => hasPermission(role, LAUNCH_PERMISSIONS[item])),
      payments: input.payments === "live" ? "test" : input.payments,
    };
  },
);
