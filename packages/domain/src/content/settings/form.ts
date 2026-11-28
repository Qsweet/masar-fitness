import {
  BOOL_ON,
  fieldPath,
  LIST_COUNT_KEY,
  type FieldSpec,
  type ListSpec,
  type SettingNode,
  type SettingObject,
  type Shape,
} from "./spec";

/**
 * النموذج المسطّح للإعداد: كل ورقة حقل نصي باسم مسارها (`items.2.question.ar`)، وعدد عناصر القائمة في
 * `items.n`، والمنطقي «1» أو فارغ. الشكل نفسه للّوحة (حقول HTML) وللفرق (ورقة ورقة).
 */
export type FlatValues = Readonly<Record<string, string>>;

function isRecord(value: unknown): value is Readonly<Record<string, SettingNode>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenLocalized(
  node: SettingNode | undefined,
  path: string,
  out: Record<string, string>,
): void {
  const record = isRecord(node) ? node : {};
  for (const locale of ["ar", "en"] as const) {
    const value = record[locale];
    out[fieldPath(path, locale)] = typeof value === "string" ? value : "";
  }
}

function flattenList(
  spec: ListSpec,
  node: SettingNode | undefined,
  path: string,
  out: Record<string, string>,
): void {
  const items = Array.isArray(node) ? node : [];
  out[fieldPath(path, LIST_COUNT_KEY)] = String(items.length);
  items.forEach((item: SettingNode, index) => {
    flattenShape(spec.item, item, fieldPath(path, index), out);
  });
}

function flattenField(
  spec: FieldSpec,
  node: SettingNode | undefined,
  path: string,
  out: Record<string, string>,
): void {
  switch (spec.kind) {
    case "text":
    case "choice":
      out[path] = typeof node === "string" ? node : "";
      return;
    case "bool":
      out[path] = node === true ? BOOL_ON : "";
      return;
    case "localized":
      flattenLocalized(node, path, out);
      return;
    case "list":
      flattenList(spec, node, path, out);
      return;
    case "group":
      flattenShape(spec.shape, node, path, out);
  }
}

function flattenShape(
  shape: Shape,
  node: SettingNode | undefined,
  path: string,
  out: Record<string, string>,
): void {
  const record = isRecord(node) ? node : {};
  for (const [name, spec] of Object.entries(shape)) {
    flattenField(spec, record[name], fieldPath(path, name), out);
  }
}

export function toForm(shape: Shape, value: SettingObject): Record<string, string> {
  const out: Record<string, string> = {};
  flattenShape(shape, value, "", out);
  return out;
}

function listCount(values: FlatValues, path: string, max: number): number {
  const count = Number(values[fieldPath(path, LIST_COUNT_KEY)] ?? "0");
  // عنصر زائد واحد يكفي ليرفض الفحص القائمة الأطول من حدها
  return Number.isInteger(count) && count > 0 ? Math.min(count, max + 1) : 0;
}

function readField(spec: FieldSpec, values: FlatValues, path: string): SettingNode {
  switch (spec.kind) {
    case "text":
    case "choice":
      return values[path] ?? "";
    case "bool":
      return values[path] === BOOL_ON;
    case "localized":
      return { ar: values[fieldPath(path, "ar")] ?? "", en: values[fieldPath(path, "en")] ?? "" };
    case "list":
      return Array.from({ length: listCount(values, path, spec.max) }, (_, index) =>
        readShape(spec.item, values, fieldPath(path, index)),
      );
    case "group":
      return readShape(spec.shape, values, path);
  }
}

function readShape(shape: Shape, values: FlatValues, path: string): SettingObject {
  return Object.fromEntries(
    Object.entries(shape).map(([name, spec]) => [
      name,
      readField(spec, values, fieldPath(path, name)),
    ]),
  );
}

/** شجرة خام من حقول النموذج؛ تمر بعدها بـ`checkShape`. */
export function fromForm(shape: Shape, values: FlatValues): SettingObject {
  return readShape(shape, values, "");
}

function fieldNames(spec: FieldSpec, path: string): string[] {
  switch (spec.kind) {
    case "text":
    case "choice":
    case "bool":
      return [path];
    case "localized":
      return [fieldPath(path, "ar"), fieldPath(path, "en")];
    case "list":
      return [fieldPath(path, LIST_COUNT_KEY)];
    case "group":
      return shapeFieldNames(spec.shape, path);
  }
}

/** أسماء حقول شكل (بلا عناصر القوائم): لقراءة النموذج بحدود معروفة. */
export function shapeFieldNames(shape: Shape, path = ""): string[] {
  return Object.entries(shape).flatMap(([name, spec]) => fieldNames(spec, fieldPath(path, name)));
}

/** مسار حقل بلا فهارس القوائم (`items.question.ar`): مفتاح تسميته في قاموس اللوحة. */
export function labelPath(field: string): string {
  return field
    .split(".")
    .filter((segment) => !/^\d+$/.test(segment))
    .join(".");
}
