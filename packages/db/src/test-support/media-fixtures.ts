/** مساعدات اختبار المكتبة والشريط: صف صورة بلا ملفات (القاعدة وحدها)، وشريحة صحيحة فوقه. */
import { randomBytes } from "node:crypto";
import type { SlideContent } from "@masar/domain";
import type { Db } from "../client";
import { staffActor } from "../staff/audit";
import { createMediaAsset, type MediaAsset } from "../content/media";

const HASH_BYTES = 32;
const SIZE = { width: 2560, height: 1440, bytes: 400_000 };
const WIDTHS = { small: 640, large: 1280, full: 2560 };

export async function createTestAsset(
  db: Db,
  clubId: string,
  staffId: string,
  width = SIZE.width,
): Promise<MediaAsset> {
  const created = await createMediaAsset(
    db,
    {
      clubId,
      staffId,
      actor: staffActor(staffId),
      sha256: randomBytes(HASH_BYTES).toString("hex"),
      width,
      height: SIZE.height,
      bytes: SIZE.bytes,
      variantWidths: Object.values(WIDTHS).filter((value) => value <= width),
      blurDataUrl: "data:image/webp;base64,AAAA",
      dominantColor: "#1a1a1a",
      originalName: "test.jpg",
      now: new Date(),
    },
    () => Promise.resolve(),
  );
  return created.asset;
}

const BLANK = { eyebrow: "", title: "", subtitle: "", cta: "" };

export function testSlideContent(
  desktop: MediaAsset,
  overrides: Partial<SlideContent> = {},
): SlideContent {
  return {
    desktop,
    mobile: null,
    decorative: false,
    alt: { ar: "صالة الأوزان", en: "The weights hall" },
    texts: { ar: { ...BLANK, title: "ابدأ اليوم" }, en: { ...BLANK, title: "Start today" } },
    link: { kind: "none" },
    clickTarget: "button",
    active: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}
