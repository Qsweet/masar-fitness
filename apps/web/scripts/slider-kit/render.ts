import sharp, { type OverlayOptions } from "sharp";
import type { Frame, Layout, Panel } from "./compositions";
import { gradeImage, type Grade } from "./grade";

/**
 * تركيب صورة من لوحاتها (docs/SLIDER_KIT.md §2): قص كل لوحة بنسبتها حول مركزها، ثم التصغير إلى عرض
 * لا يتجاوز ما في الأصل (لا تكبير أبدًا)، ثم المعالجة اللونية، ثم الخط الأصفر الرفيع أعلى الصورة وبين
 * اللوحتين، ثم JPEG عالي الجودة يمر بخط الرفع نفسه (يُعاد ترميزه على الخادم).
 */
export interface Target {
  /** نسبة الصورة كاملة (العرض ÷ الارتفاع). */
  readonly aspect: number;
  /** أقصى عرض للناتج. */
  readonly maxWidth: number;
}

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const YELLOW = "#fdd624";
const LINE = { thickness: 0.0035, minPx: 2, opacity: 0.85, fadeStart: "18%", fadeEnd: "82%" };
const JPEG = { quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" } as const;

/** نسبة اللوحة من نسبة الصورة وحصتها واتجاه التركيب. */
function panelAspect(target: Target, direction: Layout["direction"], share: number): number {
  return direction === "row" ? target.aspect * share : target.aspect / share;
}

/** أكبر قص بالنسبة المطلوبة داخل الأصل، مصغّرًا بـscale حول المركز ومحصورًا في حدوده. */
export function cropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspect: number,
  frame: Frame,
): Rect {
  const fitWidth = Math.min(sourceWidth, sourceHeight * aspect);
  const width = Math.round(fitWidth * frame.scale);
  const height = Math.round(width / aspect);
  const clampTo = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return {
    left: clampTo(Math.round(frame.focusX * sourceWidth - width / 2), sourceWidth - width),
    top: clampTo(Math.round(frame.focusY * sourceHeight - height / 2), sourceHeight - height),
    width,
    height,
  };
}

interface Prepared {
  readonly panel: Panel;
  readonly rect: Rect;
  /** عرض الصورة كاملة الذي تحتمله هذه اللوحة بلا تكبير. */
  readonly supports: number;
}

async function prepare(root: string, layout: Layout, target: Target): Promise<Prepared[]> {
  return Promise.all(
    layout.panels.map(async (panel) => {
      const meta = await sharp(`${root}/${panel.source}`).metadata();
      const aspect = panelAspect(target, layout.direction, panel.share);
      const rect = cropRect(meta.width, meta.height, aspect, panel.frame);
      const supports = layout.direction === "row" ? rect.width / panel.share : rect.width;
      return { panel, rect, supports };
    }),
  );
}

function lineSvg(width: number, height: number, layout: Layout, prepared: readonly Prepared[]) {
  const thick = Math.max(LINE.minPx, Math.round(height * LINE.thickness));
  const dividers: string[] = [];
  let offset = 0;
  for (const item of prepared.slice(0, -1)) {
    offset += item.panel.share;
    dividers.push(
      layout.direction === "row"
        ? `<rect x="${String(Math.round(width * offset - thick / 2))}" y="0" width="${String(thick)}" height="${String(height)}" fill="${YELLOW}" opacity="${String(LINE.opacity)}"/>`
        : `<rect x="0" y="${String(Math.round(height * offset - thick / 2))}" width="${String(width)}" height="${String(thick)}" fill="${YELLOW}" opacity="${String(LINE.opacity)}"/>`,
    );
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}">` +
      `<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0">` +
      `<stop offset="0" stop-color="${YELLOW}" stop-opacity="0"/>` +
      `<stop offset="${LINE.fadeStart}" stop-color="${YELLOW}" stop-opacity="${String(LINE.opacity)}"/>` +
      `<stop offset="${LINE.fadeEnd}" stop-color="${YELLOW}" stop-opacity="${String(LINE.opacity)}"/>` +
      `<stop offset="1" stop-color="${YELLOW}" stop-opacity="0"/></linearGradient></defs>` +
      `<rect x="0" y="0" width="${String(width)}" height="${String(thick)}" fill="url(#g)"/>` +
      dividers.join("") +
      `</svg>`,
  );
}

async function panelPixels(root: string, item: Prepared, size: { width: number; height: number }) {
  return sharp(`${root}/${item.panel.source}`)
    .extract(item.rect)
    .resize(size.width, size.height, { kernel: "lanczos3", fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
}

/** يركّب اللوحات ويعالجها ويرجع بايتات JPEG وأبعادها. */
export async function renderLayout(
  root: string,
  layout: Layout,
  target: Target,
  look: { readonly grade: Grade; readonly seed: number },
) {
  const prepared = await prepare(root, layout, target);
  const width = Math.floor(Math.min(target.maxWidth, ...prepared.map((item) => item.supports)));
  const height = Math.round(width / target.aspect);
  const composites: OverlayOptions[] = [];
  let offset = 0;
  for (const item of prepared) {
    const isRow = layout.direction === "row";
    const size = isRow
      ? { width: Math.round(width * item.panel.share), height }
      : { width, height: Math.round(height * item.panel.share) };
    const input = await panelPixels(root, item, size);
    composites.push({
      input,
      raw: { ...size, channels: 3 },
      left: isRow ? Math.min(offset, width - size.width) : 0,
      top: isRow ? 0 : Math.min(offset, height - size.height),
    });
    offset += isRow ? size.width : size.height;
  }
  const base = sharp({ create: { width, height, channels: 3, background: "#0a0a0a" } });
  const { data, info } = await base
    .composite(composites)
    .raw()
    .toBuffer({ resolveWithObject: true });
  gradeImage({ data, width, height, channels: info.channels }, look.grade, look.seed);
  const bytes = await sharp(data, { raw: { width, height, channels: info.channels } })
    .removeAlpha()
    .composite([{ input: lineSvg(width, height, layout, prepared) }])
    .jpeg(JPEG)
    .toBuffer();
  return { bytes, width, height };
}
