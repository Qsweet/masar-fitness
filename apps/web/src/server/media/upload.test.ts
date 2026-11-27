import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sha256Of } from "./process-image";
import { variantsComplete } from "./store";

/**
 * الرفع المكرر لا يثق بالصف وحده (القرار 77): أصل قائم بملفات كاملة يُرجع بلا معالجة، وناقصها تُعاد
 * معالجته وكتابة ملفاته تحت القفل (الصف لا يتغير). القاعدة مستبدلة: `createMediaAsset` يستدعي ضمان الملفات.
 */
const CLUB = "11111111-1111-4111-8111-111111111111";
const known = vi.fn();
const created = vi.fn();
vi.mock("@masar/db", () => ({
  staffActor: (id: string) => `staff:${id}`,
  findAssetByHash: (...args: unknown[]) => known(...args) as unknown,
  createMediaAsset: async (
    _db: unknown,
    input: { sha256: string },
    ensure: (existing: unknown) => Promise<void>,
  ) => {
    const existing = known() as unknown;
    await ensure(existing);
    created(input.sha256);
    return { asset: existing, existing: existing !== null };
  },
}));
const { uploadImage } = await import("./upload");

let root: string;
let jpeg: Uint8Array;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "masar-upload-"));
  const buffer = await sharp({
    create: { width: 1000, height: 700, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .jpeg()
    .toBuffer();
  jpeg = new Uint8Array(buffer);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const input = () => ({
  root,
  clubId: CLUB,
  staffId: "s1",
  bytes: jpeg,
  fileName: "a.jpg",
  now: new Date(),
});

describe("uploadImage مع أصل قائم", () => {
  it("ملفات ناقصة ⇒ تُعالج وتُكتب من جديد، ثم الكاملة ⇒ تُرجع بلا معالجة", async () => {
    const hash = sha256Of(jpeg);
    const existing = { id: "x", hash, widths: [640, 960, 1000] };
    known.mockReturnValue(existing);
    const first = await uploadImage({} as never, input());
    expect(first).toMatchObject({ ok: true, value: { existing: true } });
    expect(created).toHaveBeenCalledTimes(1);
    expect(await variantsComplete(root, CLUB, hash, existing.widths)).toBe(true);

    created.mockClear();
    expect(await uploadImage({} as never, input())).toMatchObject({ ok: true });
    expect(created).not.toHaveBeenCalled();

    await writeFile(join(root, CLUB, hash, "w960.webp"), "");
    await uploadImage({} as never, input());
    expect(created).toHaveBeenCalledTimes(1);
    expect(await variantsComplete(root, CLUB, hash, existing.widths)).toBe(true);
  });
});
