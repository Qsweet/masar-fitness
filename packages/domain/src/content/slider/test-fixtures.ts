import { variantWidths } from "../media/image-sniff";
import { IMAGE_VARIANT_WIDTHS } from "./limits";
import type { SlideInput } from "./validate";
import type { Slide, SlideImage } from "./types";

/** شرائح وصور لاختبارات الشريط وحدها: قيم صحيحة الشكل بلا معنى تجاري. */
const SIZE = {
  hash: 64,
  desktopWidth: 2560,
  desktopHeight: 1440,
  mobileWidth: 1080,
  mobileHeight: 1350,
};
export const HASH_A = "a".repeat(SIZE.hash);
export const HASH_B = "b".repeat(SIZE.hash);

export function testImage(overrides: Partial<SlideImage> = {}): SlideImage {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    hash: HASH_A,
    width: SIZE.desktopWidth,
    height: SIZE.desktopHeight,
    widths: variantWidths(SIZE.desktopWidth, IMAGE_VARIANT_WIDTHS),
    blur: "data:image/webp;base64,AAAA",
    color: "#202020",
    ...overrides,
  };
}

export const MOBILE_IMAGE = testImage({
  id: "22222222-2222-4222-8222-222222222222",
  hash: HASH_B,
  width: SIZE.mobileWidth,
  height: SIZE.mobileHeight,
  widths: variantWidths(SIZE.mobileWidth, IMAGE_VARIANT_WIDTHS),
});

const BLANK = { eyebrow: "", title: "", subtitle: "", cta: "" };

export function testSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    desktop: testImage(),
    mobile: null,
    decorative: false,
    alt: { ar: "صالة الأوزان", en: "The weights hall" },
    texts: {
      ar: { ...BLANK, title: "ابدأ اليوم" },
      en: { ...BLANK, title: "Start today" },
    },
    link: { kind: "none" },
    clickTarget: "button",
    active: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

export function testInput(overrides: Partial<SlideInput> = {}): SlideInput {
  return {
    desktop: testImage(),
    mobile: null,
    decorative: false,
    alt: { ar: "صالة الأوزان", en: "The weights hall" },
    texts: { ar: { ...BLANK, title: "ابدأ اليوم" }, en: { ...BLANK, title: "Start today" } },
    link: { kind: "none", internal: "", external: "", newTab: false },
    clickTarget: "button",
    active: true,
    startsAt: "",
    endsAt: "",
    ...overrides,
  };
}

export const KNOWN_PATHS: ReadonlySet<string> = new Set(["/", "/memberships", "/#plans"]);
export const CONTEXT = { knownPaths: KNOWN_PATHS, timeZone: "Asia/Riyadh" } as const;
