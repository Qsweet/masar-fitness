/**
 * نوع الصورة من بايتاتها الأولى (ADMIN_A3_SLIDER §6.1)، لا من الامتداد ولا من النوع المعلن: JPEG
 * وPNG وWebP وحدها. SVG (نص قابل للتنفيذ) وGIF وHEIC وPDF وكل ما عداها null.
 */
export const IMAGE_TYPES = ["jpeg", "png", "webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** التواقيع بالست عشري: JPEG، وPNG، و«RIFF» ثم أربعة بايتات للطول ثم «WEBP». */
const SIGNATURES = { jpeg: "ffd8ff", png: "89504e470d0a1a0a", riff: "52494646", webp: "57454250" };
const WEBP_OFFSET = 8;
const HEX = 16;

function startsWith(bytes: Uint8Array, signature: string, offset = 0): boolean {
  const length = signature.length / 2;
  const hex = Array.from(bytes.subarray(offset, offset + length), (byte) =>
    byte.toString(HEX).padStart(2, "0"),
  ).join("");
  return hex === signature;
}

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, SIGNATURES.jpeg)) {
    return "jpeg";
  }
  if (startsWith(bytes, SIGNATURES.png)) {
    return "png";
  }
  if (startsWith(bytes, SIGNATURES.riff) && startsWith(bytes, SIGNATURES.webp, WEBP_OFFSET)) {
    return "webp";
  }
  return null;
}

/** عروض النسخ المولَّدة لصورة بعرض أصلها: ما لا يتجاوز الأصل، والأصل نفسه إن كان دون أكبرها. */
export function variantWidths(sourceWidth: number, ladder: readonly number[]): number[] {
  const fitting = ladder.filter((width) => width <= sourceWidth);
  const largest = ladder.at(-1) ?? sourceWidth;
  return sourceWidth < largest && !fitting.includes(sourceWidth)
    ? [...fitting, sourceWidth]
    : fitting;
}
