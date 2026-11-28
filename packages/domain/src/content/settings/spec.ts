import type { ContentLocale } from "../locale";

/**
 * مواصفة الإعدادات المنظَّمة (ADMIN_A3_CONTENT §5): كل إعداد شكل من حقول مطبوعة النوع، لا نص حر ولا
 * HTML. الشكل نفسه يولّد نوع القيمة، وقراءة اللقطة، والتحقق عند الحفظ، ونموذج اللوحة، والفرق.
 */
export const TEXT_FORMATS = [
  "plain",
  "phone",
  "mobile",
  "email",
  "digits",
  "int",
  "year",
  "decimal",
  "rating",
  "date",
  "time",
  "plusCode",
  "path",
  "url",
] as const;
export type TextFormat = (typeof TEXT_FORMATS)[number];

export interface TextSpec {
  readonly kind: "text";
  readonly format: TextFormat;
  readonly max: number;
  readonly required: boolean;
  /** لصيغة `url`: المضيفات المسموحة حرفيًا. */
  readonly hosts: readonly string[];
}

/** ما يلزم من اللغتين: كلتاهما، أو العربية (المرجع) وحدها، أو لا شيء. */
export type LocalizedNeed = "both" | "ar" | "none";

export interface LocalizedSpec {
  readonly kind: "localized";
  readonly max: number;
  readonly need: LocalizedNeed;
  /** فقرات يفصلها سطر جديد. */
  readonly multiline: boolean;
  /** نص قانوني يذكر العملة؛ ما سواه لا سعر فيه (الأسعار من الكتالوج). */
  readonly money: boolean;
}

export interface BoolSpec {
  readonly kind: "bool";
}

export interface ChoiceSpec<O extends string = string> {
  readonly kind: "choice";
  readonly options: readonly O[];
}

export interface ListSpec<S extends Shape = Shape> {
  readonly kind: "list";
  readonly item: S;
  readonly max: number;
  /** عناصر ثابتة العدد: تُرتَّب ولا تُضاف ولا تُحذف. */
  readonly fixed: boolean;
}

export interface GroupSpec<S extends Shape = Shape> {
  readonly kind: "group";
  readonly shape: S;
}

export type FieldSpec = TextSpec | LocalizedSpec | BoolSpec | ChoiceSpec | ListSpec | GroupSpec;
export type Shape = Readonly<Record<string, FieldSpec>>;

export type Localized = Readonly<Record<ContentLocale, string>>;

export type FieldValue<F> = F extends TextSpec
  ? string
  : F extends LocalizedSpec
    ? Localized
    : F extends BoolSpec
      ? boolean
      : F extends ChoiceSpec<infer O>
        ? O
        : F extends ListSpec<infer S>
          ? readonly ShapeValue<S>[]
          : F extends GroupSpec<infer S>
            ? ShapeValue<S>
            : never;

export type ShapeValue<S extends Shape> = { readonly [K in keyof S]: FieldValue<S[K]> };

/** قيمة إعداد كما تُحفظ: شجرة JSON من نصوص ومنطقيات وقوائم وكائنات. */
export type SettingNode = string | boolean | readonly SettingNode[] | SettingObject;
export interface SettingObject {
  readonly [key: string]: string | boolean | readonly SettingNode[] | SettingObject;
}

export function text(format: TextFormat, max: number, required = false): TextSpec {
  return { kind: "text", format, max, required, hosts: [] };
}

const URL_MAX_LENGTH = 300;

export function url(hosts: readonly string[], required = false): TextSpec {
  return { kind: "text", format: "url", max: URL_MAX_LENGTH, required, hosts };
}

export function localized(
  max: number,
  need: LocalizedNeed,
  options: { readonly multiline?: boolean; readonly money?: boolean } = {},
): LocalizedSpec {
  return {
    kind: "localized",
    max,
    need,
    multiline: options.multiline ?? false,
    money: options.money ?? false,
  };
}

export function bool(): BoolSpec {
  return { kind: "bool" };
}

export function choice<const O extends string>(options: readonly O[]): ChoiceSpec<O> {
  return { kind: "choice", options };
}

export function list<S extends Shape>(item: S, max: number, fixed = false): ListSpec<S> {
  return { kind: "list", item, max, fixed };
}

export function group<S extends Shape>(shape: S): GroupSpec<S> {
  return { kind: "group", shape };
}

/** حقل داخل شكل: `address.ar`، `items.2.question.en`. */
export function fieldPath(parent: string, name: string | number): string {
  return parent === "" ? String(name) : `${parent}.${String(name)}`;
}

/** عدد عناصر القائمة في النموذج المسطّح. */
export const LIST_COUNT_KEY = "n";
/** قيمة مربع الاختيار المفعَّل في النموذج المسطّح. */
export const BOOL_ON = "1";
