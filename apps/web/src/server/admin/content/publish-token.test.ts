import { TEST_ADMIN_KEY } from "@masar/db/test-support";
import { describe, expect, it } from "vitest";
import { openPublishToken, sealPublishToken } from "./publish-token";

/** رمز النشر المختوم (ADMIN_A3_CONTENT §8.4، WP4): المنتهي، والموظف الآخر، والمعبوث به. */
const STAFF = "018f4e2a-0000-7000-8000-000000000001";
const OTHER = "018f4e2a-0000-7000-8000-000000000002";
const NOW = new Date("2026-11-28T10:00:00Z");
const MINUTE_MS = 60_000;
const payload = { digest: "a".repeat(64), latestId: "018f4e2a-0000-7000-8000-0000000000aa" };

describe("رمز النشر", () => {
  const token = sealPublishToken(TEST_ADMIN_KEY, STAFF, payload, NOW);

  it("يُفتح لصاحبه خلال عشر دقائق بما خُتم فيه", () => {
    expect(
      openPublishToken(TEST_ADMIN_KEY, STAFF, token, new Date(NOW.getTime() + 9 * MINUTE_MS)),
    ).toEqual(payload);
    const first = sealPublishToken(TEST_ADMIN_KEY, STAFF, { ...payload, latestId: null }, NOW);
    expect(openPublishToken(TEST_ADMIN_KEY, STAFF, first, NOW)?.latestId).toBeNull();
  });

  it("منتهٍ، أو من المستقبل، أو لموظف آخر، أو معبوث به ⇒ null", () => {
    expect(
      openPublishToken(TEST_ADMIN_KEY, STAFF, token, new Date(NOW.getTime() + 10 * MINUTE_MS)),
    ).toBeNull();
    expect(
      openPublishToken(TEST_ADMIN_KEY, STAFF, token, new Date(NOW.getTime() - MINUTE_MS)),
    ).toBeNull();
    expect(openPublishToken(TEST_ADMIN_KEY, OTHER, token, NOW)).toBeNull();
    expect(openPublishToken(TEST_ADMIN_KEY, STAFF, `${token.slice(0, -2)}AA`, NOW)).toBeNull();
    expect(openPublishToken(TEST_ADMIN_KEY, STAFF, "", NOW)).toBeNull();
    expect(openPublishToken(TEST_ADMIN_KEY, STAFF, "x".repeat(2000), NOW)).toBeNull();
  });

  it("بصمة بغير شكلها لا تُقبل ولو خُتمت", () => {
    const bad = sealPublishToken(TEST_ADMIN_KEY, STAFF, { ...payload, digest: "other" }, NOW);
    expect(openPublishToken(TEST_ADMIN_KEY, STAFF, bad, NOW)).toBeNull();
  });
});
