import { join } from "node:path";
import type { Db, MediaAsset } from "@masar/db";
import { DEFAULT_SLIDER_SETTINGS, validateSlide, type SlideContext } from "@masar/domain";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { STATIC_PATHS } from "@/config/routes";
import {
  kitImageFile,
  SLIDE_KIT,
  SLIDE_KIT_DIR,
  SLIDE_KIT_IDS,
  SLIDE_KIT_SETTINGS,
} from "@/content/slider-kit/kit";
import { HOME_ANCHORS } from "../content/slider-links";
import { runLaunchKit } from "./launch-kit";
import { KIT_MESSAGES } from "./messages";

/** عدّة الشريط بلا قاعدة (docs/SLIDER_KIT.md §4): النصوص والروابط والصور والرفض بلا علم الرفع. */
const WEB_ROOT = join(import.meta.dirname, "..", "..", "..");
const IMAGES = join(WEB_ROOT, SLIDE_KIT_DIR);
const KNOWN = new Set([...STATIC_PATHS, ...HOME_ANCHORS.map((anchor) => `/#${anchor}`)]);
const CONTEXT: SlideContext = { knownPaths: KNOWN, timeZone: "Asia/Riyadh" };
const DESKTOP_ASPECT = 21 / 9;
const MOBILE_ASPECT = 4 / 5;
const ASPECT_TOLERANCE = 0.01;
const MIN_DESKTOP = 1_280;
const MIN_MOBILE = 640;

function image(width: number, height: number): MediaAsset {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    hash: "a".repeat(64),
    width,
    height,
    widths: [width],
    blur: "",
    color: "#000000",
    bytes: 1,
    originalName: "kit.jpg",
    createdAt: new Date(0),
  };
}

describe("تعريف العدّة", () => {
  it("خمس شرائح بمعرّفات فريدة بترتيبها، والإعدادات هي الافتراضي (تشغيل تلقائي كل 7 ثوانٍ)", () => {
    expect(SLIDE_KIT.map((slide) => slide.id)).toEqual(SLIDE_KIT_IDS);
    expect(SLIDE_KIT_SETTINGS).toEqual(DEFAULT_SLIDER_SETTINGS);
    expect(SLIDE_KIT_SETTINGS).toEqual({ autoplay: true, intervalMs: 7_000 });
  });

  it("كل رابط من قائمة الروابط الداخلية المعروفة (صفحة ثابتة أو مرسى في الرئيسية)", () => {
    for (const slide of SLIDE_KIT) {
      expect(KNOWN.has(slide.link), slide.id).toBe(true);
    }
  });

  it.each(SLIDE_KIT.map((slide) => [slide.id, slide] as const))(
    "%s تمر بتحقق نموذج اللوحة كاملًا (الأطوال وتدقيق النصوص والرابط والزر والنص البديل)",
    (_id, slide) => {
      const result = validateSlide(
        {
          desktop: image(2_400, 1_029),
          mobile: image(1_080, 1_350),
          decorative: false,
          alt: slide.alt,
          texts: slide.texts,
          link: { kind: "internal", internal: slide.link, external: "", newTab: false },
          clickTarget: "slide",
          active: true,
          startsAt: "",
          endsAt: "",
        },
        CONTEXT,
      );
      expect(result.ok ? [] : result.error).toEqual([]);
    },
  );

  it("لا سعر ولا رقم مالي في نصوص العدّة", () => {
    const all = SLIDE_KIT.flatMap((slide) =>
      [slide.texts.ar, slide.texts.en].flatMap((texts) => [
        texts.eyebrow,
        texts.title,
        texts.subtitle,
        texts.cta,
      ]),
    ).join(" ");
    expect(all).not.toMatch(/ر\.س|ريال|SAR|SR\b|%/);
  });
});

describe("الصور المصممة", () => {
  it.each(SLIDE_KIT_IDS)(
    "%s: الحاسوب 21:9 والهاتف 4:5 بأبعاد يقبلها الشريط، JPEG بلا ألفا",
    async (id) => {
      const desktop = await sharp(join(IMAGES, kitImageFile(id, "desktop"))).metadata();
      const mobile = await sharp(join(IMAGES, kitImageFile(id, "mobile"))).metadata();
      for (const meta of [desktop, mobile]) {
        expect(meta.format).toBe("jpeg");
        expect(meta.hasAlpha).toBe(false);
      }
      expect(Math.abs(desktop.width / desktop.height - DESKTOP_ASPECT)).toBeLessThan(
        ASPECT_TOLERANCE,
      );
      expect(Math.abs(mobile.width / mobile.height - MOBILE_ASPECT)).toBeLessThan(ASPECT_TOLERANCE);
      expect(desktop.width).toBeGreaterThanOrEqual(MIN_DESKTOP);
      expect(mobile.width).toBeGreaterThanOrEqual(MIN_MOBILE);
    },
  );
});

describe("الرفض", () => {
  it("بلا MEDIA_UPLOADS يرفض برسالة عربية قبل أي قراءة أو كتابة في القاعدة", async () => {
    const untouchable = new Proxy({} as Db, {
      get() {
        throw new Error("لا يُلمس القاعدة");
      },
    });
    const outcome = await runLaunchKit({
      db: untouchable,
      media: { uploads: false, root: "/tmp/media" },
      imagesDir: IMAGES,
      context: () => Promise.resolve(CONTEXT),
      now: new Date(),
    });
    expect(outcome).toEqual({ ok: false, error: KIT_MESSAGES.uploadsOff });
    expect(KIT_MESSAGES.uploadsOff).toContain("MEDIA_UPLOADS=yes");
    expect(KIT_MESSAGES.uploadsOff).toMatch(/[؀-ۿ]/);
  });
});
