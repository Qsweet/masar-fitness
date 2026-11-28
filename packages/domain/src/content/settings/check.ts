import { singleLine } from "../../field-input";
import { sanitizeFreeText } from "../../free-text";
import { err, ok, type Result } from "../../result";
import { lintText } from "../copy-lint";
import { CONTENT_LOCALES, type ContentLocale } from "../locale";
import { textLength } from "../limits";
import { normalizeText } from "./formats";
import {
  fieldPath,
  type ChoiceSpec,
  type FieldSpec,
  type ListSpec,
  type Localized,
  type LocalizedSpec,
  type SettingNode,
  type SettingObject,
  type Shape,
  type ShapeValue,
  type TextSpec,
} from "./spec";

/**
 * فحص قيمة إعداد بشكله وتطبيعها (ADMIN_A3_CONTENT §5): عند الحفظ والنشر بتدقيق النصوص كاملًا، وعند
 * قراءة اللقطة بالشروط البنيوية وحدها (قاعدة تدقيق جديدة لا تُسقط إعدادًا منشورًا). الخطأ باسم حقله في
 * النموذج، فيظهر بجانبه.
 */
export interface SettingIssue {
  readonly field: string;
  readonly reason: string;
  /** ما يُملأ في نص السبب: الحد، أو القاعدة ومقتطفها. */
  readonly detail?: string;
}

interface Walk {
  readonly lint: boolean;
  readonly issues: SettingIssue[];
}

/** عملة أو مبلغ في نص حر: الأسعار من الكتالوج وحده (لا سعر في نص اللوحة). */
const MONEY_WORDS = /ر\.س|ريال|﷼|\bSAR\b|\briyals?\b/iu;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function report(walk: Walk, field: string, reason: string, detail?: string): void {
  if (!walk.issues.some((issue) => issue.field === field)) {
    walk.issues.push(detail === undefined ? { field, reason } : { field, reason, detail });
  }
}

function checkText(spec: TextSpec, node: unknown, path: string, walk: Walk): string {
  const value = typeof node === "string" ? singleLine(node).normalize("NFC") : "";
  if (value === "") {
    if (spec.required || typeof node !== "string") {
      report(walk, path, "settings.required");
    }
    return "";
  }
  if (textLength(value) > spec.max) {
    report(walk, path, "content.too_long", String(spec.max));
    return value;
  }
  const normalized = normalizeText(spec, value);
  if (normalized === null) {
    report(walk, path, `settings.format_${spec.format}`);
    return value;
  }
  return normalized;
}

function cleanLocalized(spec: LocalizedSpec, raw: string): string {
  const value = sanitizeFreeText(raw).normalize("NFC");
  if (!spec.multiline) {
    return value;
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

function lintIssue(spec: LocalizedSpec, value: string, locale: ContentLocale): SettingIssue | null {
  if (!spec.money && MONEY_WORDS.test(value)) {
    return { field: "", reason: "settings.no_price" };
  }
  for (const line of value.split("\n")) {
    const [lint] = lintText(line, locale);
    if (lint !== undefined) {
      return { field: "", reason: "content.copy_lint", detail: `${lint.rule}|${lint.excerpt}` };
    }
  }
  return null;
}

function textIssue(spec: LocalizedSpec, value: string): SettingIssue | null {
  if (!spec.multiline && /[\r\n\u2028\u2029]/u.test(value)) {
    return { field: "", reason: "content.multiline" };
  }
  if (/[<>{}]/u.test(value)) {
    return { field: "", reason: "settings.markup" };
  }
  return textLength(value) > spec.max
    ? { field: "", reason: "content.too_long", detail: String(spec.max) }
    : null;
}

function checkLocale(
  spec: LocalizedSpec,
  raw: unknown,
  locale: ContentLocale,
  path: string,
  walk: Walk,
): string {
  const value = typeof raw === "string" ? cleanLocalized(spec, raw) : "";
  const needed = spec.need === "both" || (spec.need === "ar" && locale === "ar");
  if (value === "") {
    if (needed || typeof raw !== "string") {
      report(walk, path, "settings.required");
    }
    return "";
  }
  const issue = textIssue(spec, value) ?? (walk.lint ? lintIssue(spec, value, locale) : null);
  if (issue !== null) {
    report(walk, path, issue.reason, issue.detail);
  }
  return value;
}

function checkLocalized(spec: LocalizedSpec, node: unknown, path: string, walk: Walk): Localized {
  const record = isRecord(node) ? node : {};
  const [ar, en] = CONTENT_LOCALES.map((locale) =>
    checkLocale(spec, record[locale], locale, fieldPath(path, locale), walk),
  );
  return { ar: ar ?? "", en: en ?? "" };
}

function checkList(spec: ListSpec, node: unknown, path: string, walk: Walk): SettingNode[] {
  if (!Array.isArray(node)) {
    report(walk, path, "settings.shape");
    return [];
  }
  if (node.length > spec.max) {
    report(walk, path, "settings.list_too_long", String(spec.max));
  }
  return node
    .slice(0, spec.max)
    .map((item: unknown, index) => walkShape(spec.item, item, fieldPath(path, index), walk));
}

function checkBool(node: unknown, path: string, walk: Walk): boolean {
  if (typeof node !== "boolean") {
    report(walk, path, "settings.shape");
  }
  return node === true;
}

function checkChoice(spec: ChoiceSpec, node: unknown, path: string, walk: Walk): string {
  if (typeof node === "string" && spec.options.includes(node)) {
    return node;
  }
  report(walk, path, "settings.choice");
  return spec.options[0] ?? "";
}

function checkField(spec: FieldSpec, node: unknown, path: string, walk: Walk): SettingNode {
  switch (spec.kind) {
    case "text":
      return checkText(spec, node, path, walk);
    case "localized":
      return checkLocalized(spec, node, path, walk);
    case "bool":
      return checkBool(node, path, walk);
    case "choice":
      return checkChoice(spec, node, path, walk);
    case "list":
      return checkList(spec, node, path, walk);
    case "group":
      return walkShape(spec.shape, node, path, walk);
  }
}

function walkShape(shape: Shape, node: unknown, path: string, walk: Walk): SettingObject {
  const record = isRecord(node) ? node : {};
  if (!isRecord(node)) {
    report(walk, path, "settings.shape");
  }
  return Object.fromEntries(
    Object.entries(shape).map(([name, spec]) => [
      name,
      checkField(spec, record[name], fieldPath(path, name), walk),
    ]),
  );
}

/**
 * القيمة مطبَّعة بترتيب الشكل (شكل قانوني للتخزين والبصمة)، أو كل أخطاء الحقول معًا. `lint: false`
 * لقراءة اللقطة: الشروط البنيوية وحدها.
 */
export function checkShape<S extends Shape>(
  shape: S,
  raw: unknown,
  options: { readonly lint: boolean },
): Result<ShapeValue<S>, readonly SettingIssue[]> {
  const walk: Walk = { lint: options.lint, issues: [] };
  const value = walkShape(shape, raw, "", walk);
  // walkShape يبني الكائن بمفاتيح الشكل نفسها وبنوع كل حقل منه، فهو ShapeValue<S> بالبناء
  return walk.issues.length > 0 ? err(walk.issues) : ok(value as ShapeValue<S>);
}
