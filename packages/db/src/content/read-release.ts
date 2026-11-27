/**
 * قراءة إصدارات المحتوى (ADMIN_A3_CONTENT §4.1). القراءة العامة استعلام صغير واحد لكل طلب على
 * فهرس (club_id, seq)؛ اللقطة تُقرأ مرة لكل إصدار ثم تبقى في ذاكرة الخادم (الإصدار لا يتغير، C1).
 */
import type { Db } from "../client";
import type { Tx } from "../commerce/transaction";

export interface ReleaseHead {
  readonly id: string;
  readonly seq: number;
  readonly digest: string;
}

export interface ReleaseRecord extends ReleaseHead {
  readonly clubId: string;
  readonly snapshot: unknown;
  readonly source: "publish" | "rollback";
  readonly changedCount: number;
  readonly rolledBackFrom: string | null;
  readonly publishedBy: string;
  readonly publishedAt: Date;
}

/** نادي المحتوى العام: أقدم نادٍ (الموقع لنادٍ واحد، سؤال المالك 12). null بلا نادٍ. */
export async function oldestClubId(db: Db): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM clubs ORDER BY created_at, id LIMIT 1`;
  return rows[0]?.id ?? null;
}

/** آخر إصدار للنادي (رأسه فقط)، أو null قبل أول نشر. */
export async function latestRelease(db: Db | Tx, clubId: string): Promise<ReleaseHead | null> {
  const rows = await db.$queryRaw<ReleaseHead[]>`
    SELECT id::text AS id, seq, digest FROM content_releases
    WHERE club_id = ${clubId}::uuid ORDER BY seq DESC LIMIT 1`;
  return rows[0] ?? null;
}

function recordOf(row: {
  id: string;
  clubId: string;
  seq: number;
  digest: string;
  snapshot: unknown;
  source: string;
  changedCount: number;
  rolledBackFrom: string | null;
  publishedBy: string;
  publishedAt: Date;
}): ReleaseRecord {
  return { ...row, source: row.source === "rollback" ? "rollback" : "publish" };
}

/** إصدار بمعرّفه داخل نادٍ، أو null (معرّف نادٍ آخر لا يُقرأ). */
export async function findRelease(
  db: Db | Tx,
  clubId: string,
  id: string,
): Promise<ReleaseRecord | null> {
  const row = await db.contentRelease.findFirst({ where: { id, clubId } });
  return row === null ? null : recordOf(row);
}
