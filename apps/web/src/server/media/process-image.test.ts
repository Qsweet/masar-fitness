import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processImage } from "./process-image";
import { parseMediaRequest } from "./serve";
import { readVariant, removeAssetFiles, storeVariants } from "./store";
import { displayName } from "./upload";

/**
 * خط معالجة الصور بـ`sharp` حقيقي (docs/ADMIN_A3_SLIDER.md §6.1، §13): البيانات الوصفية تُمحى، والنوع
 * من البايتات، والحدود، والكتابة الذرية، والمسارات المفحوصة.
 */
const CLUB = "11111111-1111-4111-8111-111111111111";
let root: string;

function photo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 120, b: 60 } } });
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "masar-media-"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("processImage", () => {
  it("JPEG بموقع GPS ⇒ نسخ AVIF وWebP بالعروض المناسبة بلا EXIF ولا GPS", async () => {
    const jpeg = await photo(1600, 1000)
      .withExif({
        IFD0: { Copyright: "secret" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "24/1 20/1 0/1" },
      })
      .jpeg()
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();
    const result = await processImage(new Uint8Array(jpeg));
    if (!result.ok) {
      throw new Error(result.error);
    }
    const image = result.value;
    expect(image).toMatchObject({ width: 1600, height: 1000, widths: [640, 960, 1280, 1600] });
    expect(image.variants).toHaveLength(8);
    for (const variant of image.variants) {
      const meta = await sharp(variant.data).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.format).toBe(variant.format === "avif" ? "heif" : "webp");
      expect(meta.width).toBe(variant.width);
    }
    expect(image.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(image.blurDataUrl.length).toBeLessThan(2048);
    expect(image.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(image.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("الاتجاه يُطبَّق: صورة EXIF بدوران 90 درجة تُخزَّن بأبعادها المعروضة", async () => {
    const rotated = await photo(1200, 800).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await processImage(new Uint8Array(rotated));
    expect(result).toMatchObject({ ok: true, value: { width: 800, height: 1200 } });
  });

  it("PNG حقيقي يُقبل أيًّا كان اسمه، وSVG باسم jpg مرفوض من بايتاته", async () => {
    const png = await photo(700, 700).png().toBuffer();
    expect((await processImage(new Uint8Array(png))).ok).toBe(true);
    const svg = new TextEncoder().encode(
      "<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'/>",
    );
    expect(await processImage(svg)).toEqual({ ok: false, error: "media.type_unsupported" });
  });

  it("صغيرة أو تالفة أو أكبر من 8 MiB: مرفوضة بسببها", async () => {
    const small = await photo(500, 900).jpeg().toBuffer();
    expect(await processImage(new Uint8Array(small))).toEqual({
      ok: false,
      error: "media.too_small",
    });
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    expect(await processImage(broken)).toEqual({ ok: false, error: "media.unreadable" });
    const huge = new Uint8Array(8 * 1_048_576 + 1);
    huge.set([0xff, 0xd8, 0xff]);
    expect(await processImage(huge)).toEqual({ ok: false, error: "media.too_large" });
  });
});

describe("التخزين", () => {
  it("كتابة ذرية بالبصمة، والتكرار لا يكتب ثانية ولا يترك مؤقتًا", async () => {
    const hash = "d".repeat(64);
    const variants = [{ width: 640, format: "webp" as const, data: Buffer.from("x") }];
    expect(await storeVariants(root, CLUB, hash, variants)).toBe(true);
    expect(await storeVariants(root, CLUB, hash, variants)).toBe(false);
    expect(await readdir(join(root, CLUB))).toEqual([hash]);
    expect((await readVariant(root, CLUB, hash, 640, "webp"))?.toString()).toBe("x");
    expect(await readVariant(root, CLUB, hash, 960, "webp")).toBeNull();
    await removeAssetFiles(root, CLUB, hash);
    expect(await readVariant(root, CLUB, hash, 640, "webp")).toBeNull();
  });

  it("مسار بغير شكل البصمة أو النادي يُرفض قبل القرص", async () => {
    await expect(readVariant(root, "..", "d".repeat(64), 640, "webp")).rejects.toThrow();
    await expect(readVariant(root, CLUB, "../etc", 640, "webp")).rejects.toThrow();
  });
});

describe("طلب الخدمة واسم الملف", () => {
  it("المعاملان بشكلهما الحرفي وحده", () => {
    const hash = "a".repeat(64);
    expect(parseMediaRequest(hash, "w1280.avif")).toEqual({ hash, width: 1280, format: "avif" });
    expect(parseMediaRequest(hash, "w640.webp")).toEqual({ hash, width: 640, format: "webp" });
    for (const file of ["../w640.webp", "w640.jpg", "w64.webp", "w640.webp.exe", "W640.webp"]) {
      expect(parseMediaRequest(hash, file)).toBeNull();
    }
    expect(parseMediaRequest("../../etc", "w640.webp")).toBeNull();
    expect(parseMediaRequest("A".repeat(64), "w640.webp")).toBeNull();
  });

  it("اسم الملف للعرض: بلا مسار ولا محارف تحكم، ومقصوص", () => {
    expect(displayName("C:\\fakepath\\صورة\u202E.jpg")).toBe("صورة.jpg");
    expect(displayName("../../x/y.png")).toBe("y.png");
    expect(displayName("")).toBe("image");
    expect(displayName("a".repeat(300))).toHaveLength(120);
  });
});
