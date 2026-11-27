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
import sharp, { type Metadata, type OutputInfo } from "sharp";
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
 * خط معالجة الصورة المرفوعة (docs/ADMIN_A3_SLIDER.md §6.1، القرار 77): النوع من البايتات السحرية، ثم
 * الترويسة وحدها (الأبعاد والبكسلات والصفحات والتشابك) قبل أي فك ترميز، ثم **فك ترميز واحد** بقراءة
 * متتابعة إلى أكبر عرض مطلوب بعد التدوير وsRGB، ومنه تُشتق النسخ والضباب واللون واحدًا بعد واحد. فلا
 * يكبر الذاكرة ولا الوقت بعدد النسخ. `withMetadata` لا يُستدعى أبدًا: لا EXIF ولا GPS ولا XMP.
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
const FORMATS: readonly MediaFormat[] = ["avif", "webp"];

export function sha256Of(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

interface Oriented {
  readonly width: number;
  readonly height: number;
}

/** سبب الرفض من الترويسة وحدها، أو null. */
function headerIssue(meta: Metadata): string | null {
  const { width, height } = meta.autoOrient;
  if ((meta.pages ?? 1) > 1) {
    return "media.animated";
  }
  if (meta.format === "png" && meta.isProgressive) {
    // PNG المتشابك يُفك كله في الذاكرة قبل أول سطر: كلفة لا تناسب حجم ملفه
    return "media.interlaced";
  }
  if (width * height > MAX_INPUT_PIXELS || Math.max(width, height) > MAX_IMAGE_SIDE) {
    return "media.too_large_pixels";
  }
  return Math.min(width, height) < MIN_IMAGE_SIDE ? "media.too_small" : null;
}

/** الأبعاد بعد التدوير من الترويسة (بلا فك ترميز)، أو سبب الرفض. */
async function inspect(bytes: Uint8Array): Promise<Result<Oriented, string>> {
  try {
    const meta = await sharp(bytes, { animated: true }).metadata();
    const issue = headerIssue(meta);
    return issue === null ? ok(meta.autoOrient) : err(issue);
  } catch {
    return err("media.unreadable");
  }
}

interface Decoded {
  readonly data: Buffer;
  readonly info: OutputInfo;
}

/** فك الترميز الوحيد: مدوَّرًا بـsRGB إلى أكبر عرض مطلوب، بكسلات خام. */
async function decode(bytes: Uint8Array, width: number): Promise<Result<Decoded, string>> {
  try {
    const decoded = await sharp(bytes, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
      sequentialRead: true,
    })
      .autoOrient()
      .toColourspace("srgb")
      .resize({ width, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return ok(decoded);
  } catch {
    return err("media.unreadable");
  }
}

function fromRaw(decoded: Decoded) {
  const { width, height, channels } = decoded.info;
  return sharp(decoded.data, { raw: { width, height, channels } });
}

async function encode(decoded: Decoded, width: number, format: MediaFormat): Promise<Variant> {
  const resized = fromRaw(decoded).resize({ width });
  const data =
    format === "avif"
      ? await resized.avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT }).toBuffer()
      : await resized.webp({ quality: WEBP_QUALITY }).toBuffer();
  return { width, format, data };
}

async function blurOf(decoded: Decoded): Promise<string> {
  const data = await fromRaw(decoded)
    .resize({ width: BLUR_WIDTH })
    .webp({ quality: BLUR_QUALITY })
    .toBuffer();
  return `data:image/webp;base64,${data.toString("base64")}`;
}

async function dominantOf(decoded: Decoded): Promise<string> {
  const { dominant } = await fromRaw(decoded).stats();
  const hex = [dominant.r, dominant.g, dominant.b]
    .map((channel) => channel.toString(HEX).padStart(COLOR_DIGITS, "0"))
    .join("");
  return `#${hex}`;
}

/** النسخ واحدة بعد واحدة من البكسلات المفكوكة (لا Promise.all: الذاكرة لنسخة واحدة في كل لحظة). */
async function variantsOf(decoded: Decoded, widths: readonly number[]): Promise<Variant[]> {
  const variants: Variant[] = [];
  for (const width of widths) {
    for (const format of FORMATS) {
      variants.push(await encode(decoded, width, format));
    }
  }
  return variants;
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
  const decoded = await decode(bytes, widths.at(-1) ?? size.value.width);
  if (!decoded.ok) {
    return decoded;
  }
  return ok({
    sha256: sha256Of(bytes),
    ...size.value,
    bytes: bytes.byteLength,
    widths,
    variants: await variantsOf(decoded.value, widths),
    blurDataUrl: await blurOf(decoded.value),
    dominantColor: await dominantOf(decoded.value),
  });
}
