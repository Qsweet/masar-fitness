import { sanitizeFreeText } from "./free-text";
import { toAsciiDigits } from "./digits";
import type { Result } from "./result";

/** خطأ حقل واحد في نموذج: الحقل وسببه الثابت، ليُعرض بجانبه. */
export interface FieldIssue {
  readonly field: string;
  readonly reason: string;
}

/** نتيجة تحقق نموذج: القيمة المطبَّعة، أو كل أخطاء الحقول معًا (لا أولها فقط). */
export type Validated<T> = Result<T, readonly FieldIssue[]>;

const WHITESPACE_RUN = /\s+/g;
const WHOLE_NUMBER = /^\d{1,9}$/;

/** نص سطر واحد كما يُحفظ: بلا محارف تحكم ولا علامات اتجاه، ومسافاته المتتالية واحدة، ومشذَّبًا. */
export function singleLine(text: string): string {
  return sanitizeFreeText(text).replace(WHITESPACE_RUN, " ");
}

/** عدد صحيح غير سالب من نص الموظف (أرقام لاتينية أو عربية)؛ null لكل ما عداه. */
export function parseWholeNumber(text: string): number | null {
  const cleaned = toAsciiDigits(singleLine(text));
  return WHOLE_NUMBER.test(cleaned) ? Number(cleaned) : null;
}

/** جامع أخطاء الحقول: يسجّل أول سبب لكل حقل. */
export class IssueList {
  readonly #issues: FieldIssue[] = [];

  add(field: string, reason: string): void {
    if (!this.#issues.some((issue) => issue.field === field)) {
      this.#issues.push({ field, reason });
    }
  }

  get all(): readonly FieldIssue[] {
    return this.#issues;
  }

  get empty(): boolean {
    return this.#issues.length === 0;
  }
}
