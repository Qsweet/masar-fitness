import type { AuditRow } from "@masar/db";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { auditRowView } from "./audit-view";

/**
 * نماذج عرض «نظرة عامة»: هندسة الرسوم، والوقت النسبي، وجملة النشاط. منطق صرف يُختبر
 * بلا قاعدة ولا متصفح؛ المكوّنات ترسم ما يخرج من هنا فقط.
 */
const DECIMAL_BASE = 10;
/** خطوات المحور زوجية (2، 4، 6، 8، 10 مضروبة في قوة العشرة)، فمنتصف المحور عدد صحيح. */
const AXIS_STEP = 2;
const MIN_AXIS_MAX = 4;
const COORDINATE_DIGITS = 2;

function round(value: number): number {
  return Number(value.toFixed(COORDINATE_DIGITS));
}

/** أعلى المحور: أصغر عدد «مريح» زوجي لا يقل عن القيمة (4، 6، 8، 10، 20، 40…)، فمنتصفه صحيح. */
export function niceAxisMax(value: number): number {
  if (value <= MIN_AXIS_MAX) {
    return MIN_AXIS_MAX;
  }
  const magnitude = DECIMAL_BASE ** Math.floor(Math.log10(value));
  for (let step = AXIS_STEP; step < DECIMAL_BASE; step += AXIS_STEP) {
    if (step * magnitude >= value) {
      return step * magnitude;
    }
  }
  return DECIMAL_BASE * magnitude;
}

export interface ChartBox {
  readonly width: number;
  readonly height: number;
  /** فراغ بين الأعمدة كنسبة من عرض الخانة. */
  readonly gapRatio: number;
}

export interface Bar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly value: number;
}

export interface BarChart {
  readonly max: number;
  /** قيم خطوط الشبكة من الأسفل إلى الأعلى: صفر، المنتصف، الأعلى. */
  readonly ticks: readonly { readonly value: number; readonly y: number }[];
  readonly bars: readonly Bar[];
}

/**
 * أعمدة بالترتيب الممرَّر (المكوّن يضع الأقدم في جهة البداية). العمود الصفري بلا ارتفاع، والقيمة
 * الموجبة لا تقل عن بكسلين حتى تُرى.
 */
export function barChart(
  values: readonly number[],
  box: ChartBox,
  max: number = niceAxisMax(Math.max(0, ...values)),
): BarChart {
  const slot = values.length === 0 ? 0 : box.width / values.length;
  const barWidth = slot * (1 - box.gapRatio);
  const minVisible = 2;
  const bars = values.map((value, index) => {
    const scaled = (value / max) * box.height;
    const height = value > 0 ? Math.max(scaled, minVisible) : 0;
    return {
      x: round(index * slot + (slot - barWidth) / 2),
      y: round(box.height - height),
      width: round(barWidth),
      height: round(height),
      value,
    };
  });
  const ticks = [0, max / 2, max].map((value) => ({
    value,
    y: round(box.height - (value / max) * box.height),
  }));
  return { max, ticks, bars };
}

/**
 * نقاط الخط الصغير (‎"x,y x,y"‎) داخل صندوق بهامش، من الأقدم إلى الأحدث. سلسلة كلها أصفار خط على
 * القاعدة، وسلسلة ثابتة موجبة خط في الوسط.
 */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  scale: { readonly min: number; readonly max: number } = {
    min: Math.min(...values, 0),
    max: Math.max(...values, 0),
  },
): string {
  const pad = 2;
  const { max, min } = scale;
  const span = max - min;
  const step = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const ratio = span === 0 ? 0 : (value - min) / span;
      const y = height - pad - ratio * (height - 2 * pad);
      return `${String(round(pad + index * step))},${String(round(y))}`;
    })
    .join(" ");
}

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 3600;
const DAY_S = 86_400;
const MAX_RELATIVE_DAYS = 7;
/** أرقام لاتينية كما في بقية اللوحة (القرار 15). */
const RELATIVE_LOCALE = "ar-u-nu-latn";

/**
 * «قبل 5 دقائق» و«أمس» و«الآن». بعد أسبوع يرجع null ليعرض المستدعي التاريخ نفسه. وقت في المستقبل
 * (فرق ساعات الخوادم) يُعامل كالآن.
 */
export function relativeTime(date: Date, now: Date): string | null {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / SECOND_MS));
  const format = new Intl.RelativeTimeFormat(RELATIVE_LOCALE, { numeric: "auto" });
  if (seconds < MINUTE_S) {
    return format.format(0, "second");
  }
  if (seconds < HOUR_S) {
    return format.format(-Math.floor(seconds / MINUTE_S), "minute");
  }
  if (seconds < DAY_S) {
    return format.format(-Math.floor(seconds / HOUR_S), "hour");
  }
  const days = Math.floor(seconds / DAY_S);
  return days <= MAX_RELATIVE_DAYS ? format.format(-days, "day") : null;
}

export interface ActivityItem {
  readonly id: string;
  readonly at: Date;
  readonly sentence: string;
}

type Names = ReadonlyMap<string, string>;

/**
 * حدث تدقيق في جملة عربية: «تغيير دور سارة بواسطة خالد». أحداث الموظفين لها قوالب في القاموس، وغيرها
 * (أحداث البيع) بالقالب العام من اسم الحدث وموضوعه وفاعله. بلا أسرار: من صف التدقيق نفسه.
 */
export function activityItem(
  row: AuditRow,
  names: Names,
  dictionary: AdminDictionary,
): ActivityItem {
  const view = auditRowView(row, names, dictionary);
  const { sentences, fallback } = dictionary.overview.activity;
  const template = lookup(sentences, row.action, fallback);
  return {
    id: row.id,
    at: row.createdAt,
    sentence: fill(template, { actor: view.actor, subject: view.subject, action: view.action }),
  };
}
