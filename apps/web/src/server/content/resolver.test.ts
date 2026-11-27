import { describe, expect, it, vi } from "vitest";
import { createPublishedReader, type ContentSource } from "./resolver";
import { textRegistry } from "./registry";

const SNAPSHOT = {
  v: 1,
  texts: { "hero.title": { ar: { value: "عنوان منشور", baseHash: "h" } } },
};

function source(overrides: Partial<ContentSource> = {}): ContentSource {
  return {
    siteClubId: vi.fn(() => Promise.resolve("club")),
    latestReleaseId: vi.fn(() => Promise.resolve("r1")),
    releaseSnapshot: vi.fn(() => Promise.resolve(SNAPSHOT)),
    ...overrides,
  };
}

const log = () => ({ error: vi.fn(), warn: vi.fn() });

describe("قراءة الإصدار المنشور", () => {
  it("اللقطة تُقرأ مرة لكل إصدار، والنادي مرة في العملية", async () => {
    const db = source();
    const read = createPublishedReader(db, textRegistry, log());
    const first = await read();
    await read();
    expect(first.releaseId).toBe("r1");
    expect(first.overrides.get("hero.title")?.ar?.value).toBe("عنوان منشور");
    expect(db.releaseSnapshot).toHaveBeenCalledTimes(1);
    expect(db.latestReleaseId).toHaveBeenCalledTimes(2);
    expect(db.siteClubId).toHaveBeenCalledTimes(1);
  });

  it("بلا إصدار: لا تجاوز ولا قراءة لقطة", async () => {
    const db = source({ latestReleaseId: vi.fn(() => Promise.resolve(null)) });
    const result = await createPublishedReader(db, textRegistry, log())();
    expect(result).toMatchObject({ releaseId: null, mode: "published" });
    expect(result.overrides.size).toBe(0);
    expect(db.releaseSnapshot).not.toHaveBeenCalled();
  });

  it("القاعدة معطلة قبل أي قراءة ⇒ الافتراضي بلا رمي، وبسطر سجل", async () => {
    const logger = log();
    const db = source({ siteClubId: vi.fn(() => Promise.reject(new Error("down"))) });
    const result = await createPublishedReader(db, textRegistry, logger)();
    expect(result).toMatchObject({ releaseId: null, mode: "defaults" });
    expect(logger.error).toHaveBeenCalledWith("content.read_failed", expect.anything());
  });

  it("القاعدة تتعطل بعد قراءة سليمة ⇒ آخر لقطة سليمة", async () => {
    let up = true;
    const db = source({
      latestReleaseId: vi.fn(() =>
        up ? Promise.resolve("r1") : Promise.reject(new Error("down")),
      ),
    });
    const read = createPublishedReader(db, textRegistry, log());
    await read();
    up = false;
    const result = await read();
    expect(result.releaseId).toBe("r1");
    expect(result.overrides.get("hero.title")?.ar?.value).toBe("عنوان منشور");
  });

  it("لقطة بشكل مجهول تُهمل بسطر سجل، والمُسقط منها يُسجَّل", async () => {
    const logger = log();
    const db = source({
      releaseSnapshot: vi.fn(() =>
        Promise.resolve({ v: 1, texts: { "hero.pause": { ar: { value: "x", baseHash: "h" } } } }),
      ),
    });
    const result = await createPublishedReader(db, textRegistry, logger)();
    expect(result.overrides.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith("content.override_dropped", {
      releaseId: "r1",
      dropped: ["hero.pause [ar]"],
    });
  });

  it("الذاكرة بحجم أربع لقطات", async () => {
    let release = 0;
    const db = source({ latestReleaseId: vi.fn(() => Promise.resolve(`r${String(release)}`)) });
    const read = createPublishedReader(db, textRegistry, log());
    for (release = 0; release < 6; release += 1) {
      await read();
    }
    release = 5;
    await read();
    release = 0;
    await read();
    expect(db.releaseSnapshot).toHaveBeenCalledTimes(7);
  });
});
