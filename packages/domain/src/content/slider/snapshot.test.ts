import { describe, expect, it } from "vitest";
import { contentDigest, diffContent } from "../diff";
import { buildSnapshot, parseSnapshot, snapshotSlider } from "../snapshot";
import { testRegistry } from "../test-registry";
import { sniffImageType, variantWidths } from "../media/image-sniff";
import { diffSlider } from "./diff";
import { unpublishableSlides } from "./publish-check";
import { parseSliderSnapshot } from "./parse";
import { sliderAssetIds, sliderJson } from "./serialize";
import { MOBILE_IMAGE, testSlide } from "./test-fixtures";
import { DEFAULT_SLIDER_SETTINGS, EMPTY_SLIDER, type SliderState } from "./types";

const fakeSha = (text: string) => `${String(text.length)}:${text.slice(0, 40)}`;
const SECOND = testSlide({
  id: "44444444-4444-4444-8444-444444444444",
  mobile: MOBILE_IMAGE,
  link: { kind: "external", url: "https://example.com/", newTab: true },
  clickTarget: "slide",
  startsAt: new Date("2026-12-01T09:00:00.000Z"),
});
const SLIDER: SliderState = { settings: DEFAULT_SLIDER_SETTINGS, slides: [testSlide(), SECOND] };

describe("الشريط في اللقطة", () => {
  it("يمر بالتسلسل والقراءة كما هو، بلا إسقاط", () => {
    const parsed = parseSliderSnapshot(JSON.parse(JSON.stringify(sliderJson(SLIDER))));
    expect(parsed).toEqual({ slider: SLIDER, dropped: [] });
  });

  it("الشريط الفارغ لا يدخل اللقطة، فبصمة مسودة بلا شريط كما كانت", () => {
    expect(buildSnapshot(new Map())).toEqual({ v: 1, texts: {} });
    expect(contentDigest(new Map(), fakeSha)).toBe(contentDigest(new Map(), fakeSha, EMPTY_SLIDER));
    expect(contentDigest(new Map(), fakeSha, SLIDER)).not.toBe(contentDigest(new Map(), fakeSha));
  });

  it("parseSnapshot لا يُسقط مفتاح الشريط، وsnapshotSlider يقرؤه", () => {
    const snapshot = buildSnapshot(new Map(), SLIDER);
    expect(parseSnapshot(snapshot, testRegistry())?.dropped).toEqual([]);
    expect(snapshotSlider(snapshot).slider).toEqual(SLIDER);
    expect(snapshotSlider({ v: 2, slider: snapshot.slider }).slider).toEqual(EMPTY_SLIDER);
    expect(snapshotSlider({ v: 1, texts: {} }).slider).toEqual(EMPTY_SLIDER);
  });

  it("يُسقط الشريحة التالفة ويبقي السليمة، والإعدادات خارج الحدود إلى الافتراضي", () => {
    const json = sliderJson(SLIDER);
    const broken = {
      settings: { autoplay: true, intervalMs: 500 },
      slides: [
        {
          ...json.slides[0],
          link: { kind: "external", url: "javascript:alert(1)", newTab: false },
        },
        { ...json.slides[1], texts: { ar: { title: "<b>" }, en: {} } },
        json.slides[1],
        json.slides[1],
        { ...json.slides[0], id: "55555555-5555-4555-8555-555555555555", alt: { ar: "", en: "" } },
      ],
    };
    const parsed = parseSliderSnapshot(broken);
    expect(parsed.slider.settings).toEqual(DEFAULT_SLIDER_SETTINGS);
    expect(parsed.slider.slides.map((slide) => slide.id)).toEqual([SECOND.id]);
    expect(parsed.dropped).toEqual(["settings", "slide:0", "slide:1", "slide:3", "slide:4"]);
    expect(parseSliderSnapshot("x").dropped).toEqual(["settings", "slides"]);
  });

  it("معرّفات الأصول بلا تكرار", () => {
    expect(sliderAssetIds(SLIDER)).toEqual([testSlide().desktop.id, MOBILE_IMAGE.id].sort());
  });

  it("فرق النصوص لا يتأثر بالشريط", () => {
    expect(diffContent(new Map(), new Map(), testRegistry())).toEqual([]);
  });
});

describe("diffSlider", () => {
  it("إضافة وإزالة وتغيير وتحريك وإعدادات", () => {
    const third = testSlide({ id: "66666666-6666-4666-8666-666666666666" });
    const before: SliderState = {
      settings: DEFAULT_SLIDER_SETTINGS,
      slides: [testSlide(), SECOND],
    };
    const after: SliderState = {
      settings: { autoplay: false, intervalMs: DEFAULT_SLIDER_SETTINGS.intervalMs },
      slides: [{ ...SECOND, active: false }, testSlide(), third],
    };
    const changes = diffSlider(before, after).map((change) =>
      change.kind === "settings"
        ? `settings:${change.fields.join(",")}`
        : `${change.kind}:${change.slideId.slice(0, 1)}:${String(change.position)}${
            change.kind === "changed" ? `:${change.fields.join(",")}` : ""
          }`,
    );
    expect(changes).toEqual([
      "changed:4:0:active",
      "moved:4:0",
      "moved:3:1",
      "added:6:2",
      "settings:autoplay",
    ]);
    expect(diffSlider(before, before)).toEqual([]);
    expect(diffSlider(before, EMPTY_SLIDER).map((change) => change.kind)).toEqual([
      "removed",
      "removed",
    ]);
  });
});

describe("sniffImageType", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  it("من البايتات لا من الامتداد", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    const webp = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
    expect(sniffImageType(bytes(...webp))).toBe("webp");
  });

  it("SVG وGIF وPDF وRIFF غير WebP مرفوضة", () => {
    const text = (value: string) => Uint8Array.from(value, (char) => char.charCodeAt(0));
    expect(sniffImageType(text("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImageType(text("GIF89a"))).toBeNull();
    expect(sniffImageType(text("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(text("RIFF0000WAVE"))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
  });

  it("عروض النسخ لا تتجاوز الأصل، والأصل الأصغر من أكبرها نسخة", () => {
    const ladder = [640, 960, 1280, 1920, 2560];
    expect(variantWidths(4000, ladder)).toEqual(ladder);
    expect(variantWidths(1500, ladder)).toEqual([640, 960, 1280, 1500]);
    expect(variantWidths(1280, ladder)).toEqual([640, 960, 1280]);
  });
});

describe("unpublishableSlides", () => {
  it("رابط داخلي لم يعد معروفًا، أو شريحة لا تمر بقراءة اللقطة، يرفضان النشر", () => {
    const internal = testSlide({
      id: "77777777-7777-4777-8777-777777777777",
      link: { kind: "internal", path: "/memberships/gone" },
      texts: {
        ar: { eyebrow: "", title: "عرض", subtitle: "", cta: "اشترك" },
        en: { eyebrow: "", title: "Offer", subtitle: "", cta: "Join" },
      },
    });
    const broken = testSlide({
      id: "88888888-8888-4888-8888-888888888888",
      alt: { ar: "", en: "" },
    });
    const slider: SliderState = {
      settings: DEFAULT_SLIDER_SETTINGS,
      slides: [testSlide(), internal, broken],
    };
    expect(unpublishableSlides(slider, new Set(["/"]))).toEqual([internal.id, broken.id]);
    expect(unpublishableSlides(slider, new Set(["/memberships/gone"]))).toEqual([broken.id]);
  });
});
