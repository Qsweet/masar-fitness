import { sanitizeFreeText } from "../../free-text";
import { err, ok, type Result } from "../../result";
import { lintText } from "../copy-lint";
import { textLength } from "../limits";
import type { ContentLocale } from "../locale";
import type { TextIssue } from "../text-override";

/**
 * نص في شريحة (ADMIN_A3_SLIDER §2) بقواعد نصوص المحتوى (ADMIN_A3_CONTENT §3.3): تنظيف المحارف، ثم
 * سطر واحد، ثم بلا أقواس معقوفة (لا عناصر نائبة في الشرائح)، ثم الحد بنقاط الترميز، ثم تدقيق النصوص.
 * الفارغ مقبول: الحقل اختياري، والإلزام قرار من يستدعي.
 */
const LINE_BREAK = /[\r\n\u2028\u2029]/u;
const BRACE = /[{}]/;

export function normalizeSlideText(
  raw: string,
  locale: ContentLocale,
  limit: number,
): Result<string, TextIssue> {
  const value = sanitizeFreeText(raw).normalize("NFC");
  if (value === "") {
    return ok("");
  }
  if (LINE_BREAK.test(value)) {
    return err({ reason: "slider.multiline" });
  }
  if (BRACE.test(value)) {
    return err({ reason: "slider.brace" });
  }
  if (textLength(value) > limit) {
    return err({ reason: "slider.too_long", detail: String(limit) });
  }
  const [lint] = lintText(value, locale);
  return lint === undefined
    ? ok(value)
    : err({ reason: "slider.copy_lint", detail: `${lint.rule}|${lint.excerpt}` });
}

/** هل النص المحفوظ بشكله النهائي (لقطة أو صف)؟ يمر بالتحقق نفسه ولا يتغير به. */
export function isStoredText(value: string, locale: ContentLocale, limit: number): boolean {
  const normalized = normalizeSlideText(value, locale, limit);
  return normalized.ok && normalized.value === value;
}
