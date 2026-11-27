import { sanitizeFreeText } from "../free-text";
import { err, ok, type Result } from "../result";
import { lintText } from "./copy-lint";
import type { ContentLocale } from "./locale";
import { TEXT_LIMITS, textLength } from "./limits";
import { hasStrayBrace, placeholderNames } from "./paths";
import type { TextEntry } from "./registry";

/**
 * التحقق من نص تجاوز قبل حفظه (ADMIN_A3_CONTENT §3.3)، بالترتيب وأول رفض يرجع. القيمة المحفوظة
 * تمر بالتحقق البنيوي نفسه عند قراءة اللقطة، فلا يصل إلى الموقع نص يكسر قالبه.
 */
export interface TextIssue {
  readonly reason: string;
  /** ما يُملأ في نص السبب: اسم العنصر النائب، أو القاعدة ومقتطفها. */
  readonly detail?: string;
}

export type TextOverrideValue =
  | { readonly kind: "override"; readonly value: string }
  /** القيمة تساوي الافتراضي: تُحفظ عودةً إليه لا تجاوزًا. */
  | { readonly kind: "default" };

const LINE_BREAK = /[\r\n\u2028\u2029]/u;

/**
 * الشروط التي لا يُعرض بدونها النص سليمًا: غير فارغ، سطر واحد (المكوّنات ترسم النص عقدة واحدة، فالسطر
 * الجديد يختفي)، العناصر النائبة نفسها التي في افتراضي اللغة نفسها، بلا قوس شارد، وضمن حد النوع.
 */
export function structuralIssue(
  entry: TextEntry,
  locale: ContentLocale,
  value: string,
): TextIssue | null {
  if (value === "") {
    return { reason: "content.empty" };
  }
  const expected = entry.placeholders[locale];
  const found = placeholderNames(value);
  const missing = expected.find((name) => !found.includes(name));
  if (missing !== undefined) {
    return { reason: "content.placeholder_missing", detail: `{${missing}}` };
  }
  const unknown = found.find((name) => !expected.includes(name));
  if (unknown !== undefined) {
    return { reason: "content.placeholder_unknown", detail: `{${unknown}}` };
  }
  if (hasStrayBrace(value)) {
    return { reason: "content.brace_stray" };
  }
  if (LINE_BREAK.test(value)) {
    return { reason: "content.multiline" };
  }
  if (textLength(value) > TEXT_LIMITS[entry.kind]) {
    return { reason: "content.too_long", detail: String(TEXT_LIMITS[entry.kind]) };
  }
  return null;
}

export function validateTextOverride(
  entry: TextEntry,
  raw: string,
  locale: ContentLocale,
): Result<TextOverrideValue, TextIssue> {
  const value = sanitizeFreeText(raw).normalize("NFC");
  const issue = structuralIssue(entry, locale, value);
  if (issue !== null) {
    return err(issue);
  }
  const [lint] = lintText(value, locale);
  if (lint !== undefined) {
    return err({ reason: "content.copy_lint", detail: `${lint.rule}|${lint.excerpt}` });
  }
  return ok(value === entry.defaults[locale] ? { kind: "default" } : { kind: "override", value });
}
