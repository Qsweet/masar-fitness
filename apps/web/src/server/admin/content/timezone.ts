import "server-only";
import { FALLBACK_TIMEZONE } from "@/config/admin";
import { staffClub } from "../club";

/** منطقة نادي الموظف لعرض الأوقات. */
export async function clubTimezone(clubId: string): Promise<string> {
  return (await staffClub(clubId))?.timezone ?? FALLBACK_TIMEZONE;
}
