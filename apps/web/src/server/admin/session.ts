import "server-only";
import {
  findSessionByTokenHash,
  sessionTokenHash,
  touchStaffSession,
  type StaffAccount,
  type StaffSessionView,
} from "@masar/db";
import type { SessionStage } from "@masar/domain";
import { cache } from "react";
import { SESSION_TOUCH_INTERVAL_MS } from "@/config/admin";
import { getDb } from "../db";
import { isLiveSession, stageOf } from "./access";
import { readSessionToken } from "./cookie";

export interface StaffContext {
  readonly staff: StaffAccount;
  readonly session: StaffSessionView;
  readonly stage: SessionStage;
}

/**
 * جلسة الطلب الحالي: تُقرأ من الكوكي مرة لكل طلب (`cache`)، وتُفحص في القاعدة عند كل طلب، فالإلغاء
 * والتعطيل يسريان فورًا. يُحدَّث «آخر نشاط» مرة في الدقيقة على الأكثر. لا كتابة للكوكي هنا: مكوّنات
 * الخادم لا تكتبها، والكوكي المنتهي يمحوه الدخول التالي.
 */
export const currentStaffSession = cache(async (): Promise<StaffContext | null> => {
  const token = await readSessionToken();
  const tokenHash = token === null ? null : sessionTokenHash(token);
  if (tokenHash === null) {
    return null;
  }
  const db = getDb();
  const found = await findSessionByTokenHash(db, tokenHash);
  const now = new Date();
  if (found === null || !isLiveSession(found.session, found.staff, now)) {
    return null;
  }
  if (now.getTime() - found.session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
    await touchStaffSession(db, found.session.id, now);
  }
  return { ...found, stage: stageOf(found.session, found.staff) };
});
