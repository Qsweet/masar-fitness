import type { DraftEntry } from "../draft";
import { toForm } from "./form";
import { isSettingId, SETTING_IDS, SETTINGS, type SettingId, type SettingValues } from "./registry";
import type { SettingObject } from "./spec";

/**
 * الإعدادات في اللقطة والمسودة (ADMIN_A3_CONTENT §5، §8): تجاوزات فقط (الغائب = الافتراضي)، بشكل قانوني
 * مرتب فلا يغيّر ترتيب الكتابة البصمة. ما لا يطابق السجل الحالي يُسقط عند القراءة ويعود الافتراضي:
 * نشر كود لا يكسر الموقع بلقطة قديمة.
 */
export const SETTING_KEY_PREFIX = "setting:";
/** لغة صف الإعداد في المسودة: الإعداد كله صف واحد بلغتيه. */
export const SETTING_LOCALE = "*";

export type SettingOverrides = ReadonlyMap<SettingId, SettingObject>;
export const NO_SETTINGS: SettingOverrides = new Map();

export interface ParsedSettings {
  readonly settings: SettingOverrides;
  /** معرّف كل إعداد أُسقط. */
  readonly dropped: readonly string[];
}

export function settingKey(id: SettingId): string {
  return `${SETTING_KEY_PREFIX}${id}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntries(entries: readonly (readonly [string, unknown])[]): ParsedSettings {
  const settings = new Map<SettingId, SettingObject>();
  const dropped: string[] = [];
  for (const [id, raw] of entries) {
    const value = isSettingId(id) ? SETTINGS[id].read(raw) : null;
    if (isSettingId(id) && value !== null) {
      settings.set(id, value);
    } else {
      dropped.push(`${SETTING_KEY_PREFIX}${id}`);
    }
  }
  return { settings, dropped };
}

/** إعدادات لقطة إصدار (`snapshot.settings`)؛ الغائب أو غير الكائن = لا تجاوزات. */
export function parseSettings(json: unknown): ParsedSettings {
  return parseEntries(isRecord(json) ? Object.entries(json) : []);
}

/** إعدادات المسودة من صفوفها (`setting:<معرّف>`)؛ القيمة الفارغة عودة إلى الافتراضي. */
export function draftSettings(entries: readonly DraftEntry[]): ParsedSettings {
  return parseEntries(
    entries
      .filter((entry) => entry.key.startsWith(SETTING_KEY_PREFIX))
      .filter((entry) => entry.raw !== null && entry.raw !== undefined)
      .map((entry) => [entry.key.slice(SETTING_KEY_PREFIX.length), entry.raw] as const),
  );
}

/** الشكل القانوني للتخزين: المعرّفات بترتيب السجل. */
export function settingsJson(settings: SettingOverrides): Record<string, SettingObject> {
  return Object.fromEntries(
    SETTING_IDS.flatMap((id) => {
      const value = settings.get(id);
      return value === undefined ? [] : [[id, value] as const];
    }),
  );
}

export interface SettingChange {
  readonly id: SettingId;
  /** الحقل في النموذج المسطّح. */
  readonly field: string;
  readonly before: string;
  readonly after: string;
}

function leaves(id: SettingId, settings: SettingOverrides, defaults: SettingValues) {
  return toForm(SETTINGS[id].shape, settings.get(id) ?? defaults[id]);
}

/** كل ورقة اختلفت قيمتها المعروضة بين مجموعتي تجاوزات، بترتيب السجل. */
export function diffSettings(
  before: SettingOverrides,
  after: SettingOverrides,
  defaults: SettingValues,
): SettingChange[] {
  return SETTING_IDS.flatMap((id) => {
    if (before.get(id) === after.get(id)) {
      return [];
    }
    const old = leaves(id, before, defaults);
    const next = leaves(id, after, defaults);
    const fields = [...new Set([...Object.keys(old), ...Object.keys(next)])];
    return fields
      .filter((field) => (old[field] ?? "") !== (next[field] ?? ""))
      .map((field) => ({ id, field, before: old[field] ?? "", after: next[field] ?? "" }));
  });
}

function either<T>(value: T | null, fallback: T): T {
  return value ?? fallback;
}

type ClubIds =
  | "club.contact"
  | "club.social"
  | "club.facts"
  | "club.rating"
  | "club.paymentMarks"
  | "club.hours";

function clubSettings(
  settings: SettingOverrides,
  defaults: SettingValues,
): Pick<SettingValues, ClubIds> {
  return {
    "club.contact": either(
      SETTINGS["club.contact"].read(settings.get("club.contact")),
      defaults["club.contact"],
    ),
    "club.social": either(
      SETTINGS["club.social"].read(settings.get("club.social")),
      defaults["club.social"],
    ),
    "club.facts": either(
      SETTINGS["club.facts"].read(settings.get("club.facts")),
      defaults["club.facts"],
    ),
    "club.rating": either(
      SETTINGS["club.rating"].read(settings.get("club.rating")),
      defaults["club.rating"],
    ),
    "club.paymentMarks": either(
      SETTINGS["club.paymentMarks"].read(settings.get("club.paymentMarks")),
      defaults["club.paymentMarks"],
    ),
    "club.hours": either(
      SETTINGS["club.hours"].read(settings.get("club.hours")),
      defaults["club.hours"],
    ),
  };
}

type HomeIds =
  | "home.sections"
  | "home.faq"
  | "home.facilities"
  | "home.testimonials"
  | "site.announcement";

function homeSettings(
  settings: SettingOverrides,
  defaults: SettingValues,
): Pick<SettingValues, HomeIds> {
  return {
    "home.sections": either(
      SETTINGS["home.sections"].read(settings.get("home.sections")),
      defaults["home.sections"],
    ),
    "home.faq": either(SETTINGS["home.faq"].read(settings.get("home.faq")), defaults["home.faq"]),
    "home.facilities": either(
      SETTINGS["home.facilities"].read(settings.get("home.facilities")),
      defaults["home.facilities"],
    ),
    "home.testimonials": either(
      SETTINGS["home.testimonials"].read(settings.get("home.testimonials")),
      defaults["home.testimonials"],
    ),
    "site.announcement": either(
      SETTINGS["site.announcement"].read(settings.get("site.announcement")),
      defaults["site.announcement"],
    ),
  };
}

type PageIds =
  | "legal.terms"
  | "legal.returns"
  | "page.location"
  | "program.personalTraining"
  | "program.rehab"
  | "program.swimming";

function pageSettings(
  settings: SettingOverrides,
  defaults: SettingValues,
): Pick<SettingValues, PageIds> {
  return {
    "legal.terms": either(
      SETTINGS["legal.terms"].read(settings.get("legal.terms")),
      defaults["legal.terms"],
    ),
    "legal.returns": either(
      SETTINGS["legal.returns"].read(settings.get("legal.returns")),
      defaults["legal.returns"],
    ),
    "page.location": either(
      SETTINGS["page.location"].read(settings.get("page.location")),
      defaults["page.location"],
    ),
    "program.personalTraining": either(
      SETTINGS["program.personalTraining"].read(settings.get("program.personalTraining")),
      defaults["program.personalTraining"],
    ),
    "program.rehab": either(
      SETTINGS["program.rehab"].read(settings.get("program.rehab")),
      defaults["program.rehab"],
    ),
    "program.swimming": either(
      SETTINGS["program.swimming"].read(settings.get("program.swimming")),
      defaults["program.swimming"],
    ),
  };
}

/**
 * الإعدادات كلها بقيمها المطبوعة: التجاوز إن صحّ، وإلا الافتراضي. سطر لكل معرّف، فالنوع يُتحقق منه
 * لكل إعداد بلا تحويل.
 */
export function resolveSettings(
  settings: SettingOverrides,
  defaults: SettingValues,
): SettingValues {
  return {
    ...clubSettings(settings, defaults),
    ...homeSettings(settings, defaults),
    ...pageSettings(settings, defaults),
  };
}
