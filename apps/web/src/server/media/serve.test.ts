import { DEFAULT_SLIDER_SETTINGS, type Slide, type SlideImage } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { liveImageHashes } from "./serve";

/** الصور العامة (القرار 77): صور الشرائح السارية الآن وحدها، لا كل صورة في الإصدار. */
const NOW = new Date("2026-12-01T09:00:00.000Z");

function image(hash: string): SlideImage {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    hash: hash.repeat(64),
    width: 2560,
    height: 1440,
    widths: [640],
    blur: "data:image/webp;base64,AAAA",
    color: "#000000",
  };
}

function slide(overrides: Partial<Slide>): Slide {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    desktop: image("a"),
    mobile: null,
    decorative: true,
    alt: { ar: "", en: "" },
    texts: {
      ar: { eyebrow: "", title: "", subtitle: "", cta: "" },
      en: { eyebrow: "", title: "", subtitle: "", cta: "" },
    },
    link: { kind: "none" },
    clickTarget: "button",
    active: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

describe("liveImageHashes", () => {
  it("السارية بصورتيها، ولا المخفية ولا المجدولة ولا المنتهية", () => {
    const slides = [
      slide({ mobile: image("b") }),
      slide({ desktop: image("c"), active: false }),
      slide({ desktop: image("d"), startsAt: new Date("2027-01-01T00:00:00.000Z") }),
      slide({ desktop: image("e"), endsAt: NOW }),
    ];
    const hashes = liveImageHashes({ settings: DEFAULT_SLIDER_SETTINGS, slides }, NOW);
    expect([...hashes].map((hash) => hash[0])).toEqual(["a", "b"]);
  });
});
