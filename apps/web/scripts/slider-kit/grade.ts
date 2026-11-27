/**
 * المعالجة اللونية لصور عدّة الشريط (docs/SLIDER_KIT.md §2): لون الموقع الداكن الدافئ نفسه الذي في صور
 * الأماكن المعالجة (صف البنش، رفوف الدمبلز): أخضر الأرضية وأزرق الجدران مكتومان، والأصفر والجلد كما هما،
 * والظلال سوداء عميقة، والأضواء كهرمانية، وتعتيم أطراف وحبيبات خفيفة. حتمية: البذرة تثبّت الحبيبات، فإعادة
 * التشغيل تعطي البايتات نفسها.
 */
export interface Grade {
  /** ضرب الإضاءة قبل المنحنى (أقل من 1 أغمق). */
  readonly exposure: number;
  /** قوة منحنى S بين 0 و1. */
  readonly contrast: number;
  /** ما يبقى من التشبع العام. */
  readonly saturation: number;
  /** كتم الأخضر والأزرق بين 0 و1. */
  readonly coolMute: number;
  /** الكهرماني في الأضواء بين 0 و1. */
  readonly warmth: number;
  /** تعتيم الأطراف بين 0 و1. */
  readonly vignette: number;
  /** سعة الحبيبات (من 0 إلى 1 في مقياس القناة). */
  readonly grain: number;
}

export interface RawImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
}

const MAX_BYTE = 255;
const RGB = 3;
/** معامل smoothstep المعروف 3t² − 2t³. */
const SMOOTH = 3;
const FULL_TURN = 360;
const HUE_SECTOR = 60;
/** قطاعات دائرة الألوان: الأخضر يبدأ من 2، والأزرق من 4. */
const SECTOR = { count: 6, green: 2, blue: 4 };
const LUMA = { r: 0.2126, g: 0.7152, b: 0.0722 };
/** نطاقات الألوان المكتومة والمحفوظة: مركز ونصف عرض بالدرجات. */
const HUES = {
  green: { center: 120, width: 55, weight: 1 },
  blue: { center: 205, width: 40, weight: 0.85 },
  amber: { center: 45, width: 22, boost: 0.12 },
};
const TONE = { black: 0.025, shoulder: 0.94 };
const WARM = { from: 0.4, red: 0.07, green: 0.035, blue: -0.06, shadowGreen: -0.012, shadow: 0.3 };
/** شكل التعتيم: بيضاوي، ومركزه أعلى قليلًا من الوسط، وأقوى في الأسفل حيث النص. */
const VIGNETTE = { centerY: 0.42, spanX: 0.62, spanY: 0.68, start: 0.35, end: 1.45 };
const GRAIN_MIDS = 0.45;
const PRNG = {
  multiplier: 0x6d2b79f5,
  shiftA: 15,
  shiftB: 7,
  shiftC: 14,
  odd: 61,
  range: 4_294_967_296,
};

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (SMOOTH - 2 * t);
}

/** قرب اللون من مركز نطاق على دائرة الألوان (1 في المركز، 0 خارج نصف العرض). */
function bell(hue: number, center: number, width: number): number {
  const raw = Math.abs(hue - center) % FULL_TURN;
  const distance = Math.min(raw, FULL_TURN - raw);
  return 1 - smoothstep(0, width, distance);
}

function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) {
    return 0;
  }
  const sector =
    max === r
      ? ((g - b) / delta) % SECTOR.count
      : max === g
        ? (b - r) / delta + SECTOR.green
        : (r - g) / delta + SECTOR.blue;
  return (sector * HUE_SECTOR + FULL_TURN) % FULL_TURN;
}

/** mulberry32: مولّد صغير حتمي للحبيبات. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + PRNG.multiplier) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> PRNG.shiftA), t | 1);
    t ^= t + Math.imul(t ^ (t >>> PRNG.shiftB), t | PRNG.odd);
    return ((t ^ (t >>> PRNG.shiftC)) >>> 0) / PRNG.range;
  };
}

/** كم يبقى من تشبع هذا اللون: الأخضر والأزرق يُكتمان، والكهرماني يُزاد قليلًا. */
function keepFor(hue: number, grade: Grade): number {
  const mute =
    grade.coolMute *
    Math.max(
      HUES.green.weight * bell(hue, HUES.green.center, HUES.green.width),
      HUES.blue.weight * bell(hue, HUES.blue.center, HUES.blue.width),
    );
  const boost = 1 + HUES.amber.boost * bell(hue, HUES.amber.center, HUES.amber.width);
  return grade.saturation * (1 - mute) * boost;
}

/** منحنى S بكتف ناعم وأسود عميق. */
function tone(value: number, contrast: number): number {
  const x = clamp01(value);
  const s = smoothstep(0, 1, x);
  const curved = x + contrast * (s - x);
  return clamp01((curved - TONE.black) / (TONE.shoulder - TONE.black));
}

function vignetteAt(x: number, y: number, image: RawImage, strength: number): number {
  const dx = (x / image.width - 1 / 2) / VIGNETTE.spanX;
  const dy = (y / image.height - VIGNETTE.centerY) / VIGNETTE.spanY;
  return 1 - strength * smoothstep(VIGNETTE.start, VIGNETTE.end, dx * dx + dy * dy);
}

type Rgb = [number, number, number];

function gradePixel(rgb: Rgb, grade: Grade): Rgb {
  const [r, g, b] = rgb;
  const luma = LUMA.r * r + LUMA.g * g + LUMA.b * b;
  const keep = keepFor(hueOf(r, g, b), grade);
  const out = rgb.map((channel) =>
    tone((luma + (channel - luma) * keep) * grade.exposure, grade.contrast),
  );
  const lit = LUMA.r * (out[0] ?? 0) + LUMA.g * (out[1] ?? 0) + LUMA.b * (out[2] ?? 0);
  const highlight = grade.warmth * smoothstep(WARM.from, 1, lit);
  const shadow = 1 - smoothstep(0, WARM.shadow, lit);
  return [
    (out[0] ?? 0) + WARM.red * highlight,
    (out[1] ?? 0) + WARM.green * highlight + WARM.shadowGreen * shadow,
    (out[2] ?? 0) + WARM.blue * highlight,
  ];
}

/** يعالج البكسلات في مكانها (RGB أو RGBA بثماني بتات). */
export function gradeImage(image: RawImage, grade: Grade, seed: number): void {
  const random = seededRandom(seed);
  const { data, width, height, channels } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * channels;
      const rgb: Rgb = [
        (data[at] ?? 0) / MAX_BYTE,
        (data[at + 1] ?? 0) / MAX_BYTE,
        (data[at + 2] ?? 0) / MAX_BYTE,
      ];
      const graded = gradePixel(rgb, grade);
      const shade = vignetteAt(x, y, image, grade.vignette);
      const lit = LUMA.g * graded[1];
      const noise = (random() - 1 / 2) * 2 * grade.grain * (1 - GRAIN_MIDS * Math.abs(2 * lit - 1));
      for (let channel = 0; channel < RGB; channel += 1) {
        data[at + channel] = Math.round(clamp01((graded[channel] ?? 0) * shade + noise) * MAX_BYTE);
      }
    }
  }
}
