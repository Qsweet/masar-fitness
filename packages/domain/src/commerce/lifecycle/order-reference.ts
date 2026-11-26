import { toAsciiDigits } from "../../digits";
import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";

/** شكل مرجع الطلب كما تولّده القاعدة: ‎MSR-‎ ثم سبعة أرقام على الأقل. */
const PREFIX = "MSR-";
const MIN_DIGITS = 7;
/** تسلسل القاعدة bigint؛ عشرة أرقام تكفي لمليارات الطلبات وتحدّ ما يصل إلى الاستعلام. */
const MAX_DIGITS = 10;
const REFERENCE_SHAPE = /^(?:MSR-?)?(\d+)$/i;

/**
 * يطبّع ما يكتبه الموظف في خانة البحث إلى مرجع بشكله المخزَّن: «MSR-0001234» أو «msr0001234» أو
 * الأرقام وحدها «1234»، بأرقام لاتينية أو عربية. البحث بعده مطابقة تامة.
 */
export function parseOrderReference(input: string): Result<string, DomainError> {
  const text = toAsciiDigits(input.replace(/\p{Cf}/gu, "").trim());
  const digits = REFERENCE_SHAPE.exec(text)?.[1]?.replace(/^0+(?=\d)/, "");
  if (digits === undefined || digits.length > MAX_DIGITS || /^0+$/.test(digits)) {
    return err(new DomainError("validation", "order.reference_invalid", { field: "reference" }));
  }
  return ok(`${PREFIX}${digits.padStart(MIN_DIGITS, "0")}`);
}
