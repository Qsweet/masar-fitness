import "server-only";
import { createHash } from "node:crypto";
import {
  err,
  IMAGE_VARIANT_WIDTHS,
  ok,
  sniffImageType,
  variantWidths,
  type Result,
} from "@masar/domain";
import sharp from "sharp";
import {
  AVIF_EFFORT,
  AVIF_QUALITY,
  BLUR_QUALITY,
  BLUR_WIDTH,
  MAX_IMAGE_SIDE,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
  MIN_IMAGE_SIDE,
  WEBP_QUALITY,
  type MediaFormat,
} from "@/config/media-library";

/**
 * خط معالجة الصورة المرفوعة (docs/ADMIN_A3_SLIDER.md §6.1): النوع من البايتات السحرية، ثم `sharp`
 * بحد البكسلات وصفحة واحدة، ثم تدوير حسب الاتجاه وsRGB، ثم إعادة ترميز كاملة إلى AVIF وWebP بعدة عروض.
 * `withMetadata` لا يُستدعى أبدًا، فلا EXIF ولا GPS ولا XMP في أي نسخة. البايتات الأصلية لا تُحفظ.
 */
export interface Variant {
  readonly width: number;
  readonly format: MediaFormat;
  readonly data: Buffer;
}

export interface ProcessedImage {
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly widths: readonly number[];
  readonly variants: readonly Variant[];
  readonly blurDataUrl: string;
  readonly dominantColor: string;
}

const HEX = 16;
const COLOR_DIGITS = 2;

export function sha256Of(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function pipeline(bytes: Uint8Array) {
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", animated: false });
}

interface Oriented {
  readonly width: number;
  readonly height: number;
}

/** الأبعاد بعد التدوير، أو سبب الرفض. */
async function inspect(bytes: Uint8Array): Promise<Result<Oriented, string>> {
  try {
    const meta = await pipeline(bytes).metadata();
    if ((meta.pages ?? 1) > 1) {
      return err("media.animated");
    }
    const width = meta.autoOrient.width;
    const height = meta.autoOrient.height;
    const tooSmall = Math.min(width, height) < MIN_IMAGE_SIDE;
    const tooLarge = Math.max(width, height) > MAX_IMAGE_SIDE;
    return tooSmall
      ? err("media.too_small")
      : tooLarge
        ? err("media.too_large_pixels")
        : ok({ width, height });
  } catch {
    // ملف تالف، أو بكسلات فوق الحد قبل فك الترميز
    return err("media.unreadable");
  }
}

function normalized(bytes: Uint8Array) {
  return pipeline(bytes).autoOrient().toColourspace("srgb");
}

async function encode(bytes: Uint8Array, width: number, format: MediaFormat): Promise<Variant> {
  const resized = normalized(bytes).resize({ width, withoutEnlargement: true });
  const data =
    format === "avif"
      ? await resized.avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT }).toBuffer()
      : await resized.webp({ quality: WEBP_QUALITY }).toBuffer();
  return { width, format, data };
}

async function blurOf(bytes: Uint8Array): Promise<string> {
  const data = await normalized(bytes)
    .resize({ width: BLUR_WIDTH })
    .webp({ quality: BLUR_QUALITY })
    .toBuffer();
  return `data:image/webp;base64,${data.toString("base64")}`;
}

async function dominantOf(bytes: Uint8Array): Promise<string> {
  const { dominant } = await normalized(bytes).stats();
  const hex = [dominant.r, dominant.g, dominant.b]
    .map((channel) => channel.toString(HEX).padStart(COLOR_DIGITS, "0"))
    .join("");
  return `#${hex}`;
}

export async function processImage(bytes: Uint8Array): Promise<Result<ProcessedImage, string>> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return err("media.too_large");
  }
  if (sniffImageType(bytes) === null) {
    return err("media.type_unsupported");
  }
  const size = await inspect(bytes);
  if (!size.ok) {
    return size;
  }
  const widths = variantWidths(size.value.width, IMAGE_VARIANT_WIDTHS);
  const variants = await Promise.all(
    widths.flatMap((width) => [encode(bytes, width, "avif"), encode(bytes, width, "webp")]),
  );
  return ok({
    sha256: sha256Of(bytes),
    ...size.value,
    bytes: bytes.byteLength,
    widths,
    variants,
    blurDataUrl: await blurOf(bytes),
    dominantColor: await dominantOf(bytes),
  });
}
