import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, findRelease, latestRelease, oldestClubId, type Db } from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

/** إصدارات المحتوى (ADMIN_A3_CONTENT §10، WP2): C1 بـSQL خام، وعزل النادي، وقيود الشكل. */
const DIGEST = "a".repeat(64);
let db: Db;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function insertRelease(
  clubId: string,
  staffId: string,
  seq: number,
  extra: { source?: string; rolledBackFrom?: string | null } = {},
): Promise<string> {
  const id = randomUUID();
  await db.$executeRaw`
    INSERT INTO content_releases (id, club_id, seq, snapshot, schema_version, digest, source,
      changed_count, rolled_back_from, published_by, published_at)
    VALUES (${id}::uuid, ${clubId}::uuid, ${seq}, ${JSON.stringify({ v: 1, texts: {} })}::jsonb, 1,
      ${DIGEST}, ${extra.source ?? "publish"}, 0, ${extra.rolledBackFrom ?? null}::uuid,
      ${staffId}::uuid, now())`;
  return id;
}

async function setup() {
  const clubId = await createTestClub(db);
  const staff = await createTestStaff(db, clubId);
  return { clubId, staffId: staff.id };
}

describe("content_releases", () => {
  it("C1: الإصدار لا يُعدَّل ولا يُحذف ولو بـSQL خام", async () => {
    const { clubId, staffId } = await setup();
    const id = await insertRelease(clubId, staffId, 1);
    await expect(
      db.$executeRaw`UPDATE content_releases SET changed_count = 5 WHERE id = ${id}::uuid`,
    ).rejects.toThrow("content_release_immutable");
    await expect(
      db.$executeRaw`DELETE FROM content_releases WHERE id = ${id}::uuid`,
    ).rejects.toThrow("content_release_immutable");
  });

  it("آخر إصدار بالرقم لكل نادٍ، ونادٍ آخر لا يرى إصدارات غيره", async () => {
    const first = await setup();
    const second = await setup();
    await insertRelease(first.clubId, first.staffId, 1);
    const latest = await insertRelease(first.clubId, first.staffId, 2);
    expect(await latestRelease(db, first.clubId)).toEqual({ id: latest, seq: 2, digest: DIGEST });
    expect(await latestRelease(db, second.clubId)).toBeNull();
    expect(await findRelease(db, second.clubId, latest)).toBeNull();
    expect((await findRelease(db, first.clubId, latest))?.seq).toBe(2);
  });

  it("الرقم فريد في النادي، والاسترجاع وحده يشير إلى إصدار سابق", async () => {
    const { clubId, staffId } = await setup();
    const first = await insertRelease(clubId, staffId, 1);
    await expect(insertRelease(clubId, staffId, 1)).rejects.toThrow(
      "content_releases_club_id_seq_key",
    );
    await expect(
      insertRelease(clubId, staffId, 2, { source: "publish", rolledBackFrom: first }),
    ).rejects.toThrow("content_releases_rollback_source");
    await expect(insertRelease(clubId, staffId, 2, { source: "rollback" })).rejects.toThrow(
      "content_releases_rollback_source",
    );
    await expect(insertRelease(clubId, staffId, 2, { source: "draft" })).rejects.toThrow(
      "content_releases_source_known",
    );
    await insertRelease(clubId, staffId, 2, { source: "rollback", rolledBackFrom: first });
  });

  it("نادي المحتوى العام أقدم نادٍ", async () => {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM clubs ORDER BY created_at, id LIMIT 1`;
    expect(await oldestClubId(db)).toBe(rows[0]?.id);
  });
});
