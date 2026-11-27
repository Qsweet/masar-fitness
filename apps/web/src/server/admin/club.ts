import "server-only";
import { clubPasswordWords } from "@masar/domain";
import { findClubSummary, listClubs, type ClubSummary } from "@masar/db";
import { cache } from "react";
import { getDb } from "../db";

const globalForClub = globalThis as typeof globalThis & { masarAdminFirstClubId?: string };

/**
 * النادي الذي تُنسب إليه محاولة دخول لا حساب لها (سجل التدقيق يشترط ناديًا): أقدم نادٍ في القاعدة.
 * المنصة اليوم لنادٍ واحد. null إن لم يوجد نادٍ بعد، فلا يُكتب سطر.
 */
export async function fallbackAuditClubId(): Promise<string | null> {
  if (globalForClub.masarAdminFirstClubId === undefined) {
    const [first] = await listClubs(getDb());
    if (first === undefined) {
      return null;
    }
    globalForClub.masarAdminFirstClubId = first.id;
  }
  return globalForClub.masarAdminFirstClubId;
}

/** نادي الموظف (اسمه ومنطقته الزمنية) لعناوين اللوحة وأرقامها؛ مرة لكل طلب (الهيكل والصفحة). */
export const staffClub = cache(
  (clubId: string): Promise<ClubSummary | null> => findClubSummary(getDb(), clubId),
);

/** كلمات اسم النادي الممنوعة في كلمات مرور موظفيه. */
export async function passwordForbiddenWords(clubId: string): Promise<string[]> {
  const clubs = await listClubs(getDb());
  const club = clubs.find((candidate) => candidate.id === clubId);
  return club === undefined ? [] : clubPasswordWords(club);
}
