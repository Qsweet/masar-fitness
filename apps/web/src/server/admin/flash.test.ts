import { afterEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      set: (name: string, value: string) => {
        jar.set(name, value);
      },
    }),
}));
const KEY = Uint8Array.from({ length: 32 }, (_, index) => index);
vi.mock("../env", () => ({ getEnv: () => ({ SITE_URL: "https://example.com" }) }));
vi.mock("./flag", () => ({ adminSecretKey: () => KEY }));

const { clearFlash, readFlash, writeFlash } = await import("./flash");

const VIEWER = "018f4e2a-0000-7000-8000-000000000001";
const ISSUED = new Date("2026-11-26T10:00:00Z");
const MINUTE_MS = 60_000;
const FLASH = { kind: "recovery_codes", subject: VIEWER, values: ["AAAA-BBBB-CCCC-DDDD"] } as const;
const COOKIE = "__Host-masar_admin_flash";

afterEach(() => {
  jar.clear();
});

describe("السر المعروض مرة", () => {
  it("يُقرأ لصاحبه داخل المهلة، مشفّرًا في الكوكي", async () => {
    await writeFlash(VIEWER, { ...FLASH, values: [...FLASH.values] }, ISSUED);
    expect(jar.get(COOKIE)).not.toContain("AAAA");
    const read = await readFlash(VIEWER, new Date(ISSUED.getTime() + 9 * MINUTE_MS));
    expect(read).toEqual(FLASH);
  });

  it("الخادم يرفضه بعد عشر دقائق ولو بقي الكوكي في المتصفح", async () => {
    await writeFlash(VIEWER, { ...FLASH, values: [...FLASH.values] }, ISSUED);
    expect(await readFlash(VIEWER, new Date(ISSUED.getTime() + 10 * MINUTE_MS))).toBeNull();
    expect(await readFlash(VIEWER, new Date(ISSUED.getTime() + 60 * MINUTE_MS))).toBeNull();
  });

  it("وقت إصدار من المستقبل مرفوض", async () => {
    await writeFlash(VIEWER, { ...FLASH, values: [...FLASH.values] }, ISSUED);
    expect(await readFlash(VIEWER, new Date(ISSUED.getTime() - MINUTE_MS))).toBeNull();
  });

  it("مشاهد آخر أو كوكي معبوث به أو ممحوّ: لا شيء", async () => {
    await writeFlash(VIEWER, { ...FLASH, values: [...FLASH.values] }, ISSUED);
    expect(await readFlash("018f4e2a-0000-7000-8000-000000000002", ISSUED)).toBeNull();
    const sealed = jar.get(COOKIE) ?? "";
    const [version, iv, tag, body = ""] = sealed.split(".");
    const flipped = `${body.startsWith("A") ? "B" : "A"}${body.slice(1)}`;
    jar.set(COOKIE, [version, iv, tag, flipped].join("."));
    expect(await readFlash(VIEWER, ISSUED)).toBeNull();
    jar.set(COOKIE, sealed);
    expect(await readFlash(VIEWER, ISSUED)).not.toBeNull();
    await clearFlash();
    expect(await readFlash(VIEWER, ISSUED)).toBeNull();
  });
});
