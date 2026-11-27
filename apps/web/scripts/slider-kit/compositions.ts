import type { SlideKitId } from "../../src/content/slider-kit/kit";
import type { Grade } from "./grade";

/**
 * تكوينات صور عدّة الشريط (docs/SLIDER_KIT.md §2): من أي صورة حقيقية للنادي، وأين مركز القص، وكم يُكبَّر،
 * ولكل شريحة قصّان: الحاسوب 21:9 (يُعرض 16:9 على اللوحي بقص الجانبين، فالموضوع في الوسط) والهاتف 4:5
 * (النص في أسفله، فالموضوع في أعلاه). لوحتان في تكوين واحد بينهما خط أصفر رفيع حيث تحكي الشريحة مكانين.
 */
export interface Frame {
  /** مركز القص في الأصل (0..1 من العرض والارتفاع). */
  readonly focusX: number;
  readonly focusY: number;
  /** حجم القص من أكبر قص ممكن بالنسبة المطلوبة (1 = أكبر قص). */
  readonly scale: number;
}

export interface Panel {
  /** مسار الصورة من مجلد الويب. */
  readonly source: string;
  readonly frame: Frame;
  /** حصة اللوحة من العرض (صف) أو الارتفاع (عمود). */
  readonly share: number;
}

export interface Layout {
  readonly direction: "row" | "column";
  readonly panels: readonly Panel[];
}

export interface Composition {
  readonly id: SlideKitId;
  readonly desktop: Layout;
  readonly mobile: Layout;
  readonly grade: Grade;
  readonly seed: number;
}

const PHOTOS = "src/assets/photos";

/** صور الأشخاص الحقيقية: كتم الأخضر والأزرق أقوى، والأماكن المعالجة سلفًا بلمسة أخف. */
const PEOPLE: Grade = {
  exposure: 0.8,
  contrast: 0.5,
  saturation: 0.85,
  coolMute: 0.88,
  warmth: 0.5,
  vignette: 0.7,
  grain: 0.022,
};
const TREATED: Grade = { ...PEOPLE, exposure: 0.97, contrast: 0.2, coolMute: 0.6, warmth: 0.3 };
const WATER: Grade = { ...PEOPLE, exposure: 0.7, saturation: 0.8, coolMute: 0.5, warmth: 0.35 };

function single(source: string, frame: Frame): Layout {
  return { direction: "row", panels: [{ source: `${PHOTOS}/${source}`, frame, share: 1 }] };
}

export const COMPOSITIONS: readonly Composition[] = [
  {
    id: "coaches",
    desktop: single("trainer-portrait.jpg", { focusX: 0.45, focusY: 0.36, scale: 0.9 }),
    mobile: single("trainer-portrait.jpg", { focusX: 0.27, focusY: 0.5, scale: 0.95 }),
    grade: PEOPLE,
    seed: 101,
  },
  {
    id: "classes",
    desktop: single("functional-squat.jpg", { focusX: 0.5, focusY: 0.5, scale: 1 }),
    mobile: single("functional-squat.jpg", { focusX: 0.43, focusY: 0.5, scale: 1 }),
    grade: PEOPLE,
    seed: 202,
  },
  {
    id: "equipment",
    desktop: single("machines-turf.jpg", { focusX: 0.5, focusY: 0.52, scale: 1 }),
    mobile: single("machines-turf.jpg", { focusX: 0.74, focusY: 0.5, scale: 1 }),
    grade: TREATED,
    seed: 303,
  },
  {
    id: "recovery",
    desktop: {
      direction: "row",
      panels: [
        { source: `${PHOTOS}/pool.jpg`, frame: { focusX: 0.5, focusY: 0.6, scale: 1 }, share: 0.6 },
        {
          source: `${PHOTOS}/sauna.jpg`,
          frame: { focusX: 0.66, focusY: 0.6, scale: 1 },
          share: 0.4,
        },
      ],
    },
    mobile: {
      direction: "column",
      panels: [
        {
          source: `${PHOTOS}/pool.jpg`,
          frame: { focusX: 0.5, focusY: 0.6, scale: 1 },
          share: 0.56,
        },
        {
          source: `${PHOTOS}/sauna.jpg`,
          frame: { focusX: 0.66, focusY: 0.62, scale: 1 },
          share: 0.44,
        },
      ],
    },
    grade: WATER,
    seed: 404,
  },
  {
    id: "memberships",
    desktop: single("bench-row.jpg", { focusX: 0.5, focusY: 0.5, scale: 1 }),
    mobile: single("bench-row.jpg", { focusX: 0.62, focusY: 0.5, scale: 1 }),
    grade: TREATED,
    seed: 505,
  },
];
