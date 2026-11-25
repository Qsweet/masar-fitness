import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";
import { parseSaudiMobile, type SaudiMobile } from "../../saudi-mobile";

/** اسم مشترٍ منظَّف. يُبنى عبر `parseBuyerName` فقط. */
export type BuyerName = string & { readonly __brand: "BuyerName" };

export interface Buyer {
  readonly name: BuyerName;
  readonly mobile: SaudiMobile;
}

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;
/** علامات الاتجاه والمحارف غير المرئية تصل من النسخ واللصق. */
const INVISIBLE = /\p{Cf}/gu;
const WHITESPACE_RUN = /\s+/gu;
const CONTROL = /\p{Cc}/u;
const LETTER = /\p{L}/u;

function nameError(reason: string): DomainError {
  return new DomainError("validation", reason, { field: "name" });
}

/**
 * يزيل المحارف غير المرئية ويوحّد المسافات ويقصّ الطرفين.
 * الطول بالمحارف لا بوحدات UTF-16، ويُشترط حرف واحد على الأقل.
 */
export function parseBuyerName(input: string): Result<BuyerName, DomainError> {
  const cleaned = input.replace(INVISIBLE, "").replace(WHITESPACE_RUN, " ").trim();
  const length = Array.from(cleaned).length;
  if (length < MIN_NAME_LENGTH) {
    return err(nameError("buyer.name_too_short"));
  }
  if (length > MAX_NAME_LENGTH) {
    return err(nameError("buyer.name_too_long"));
  }
  // محارف التحكم (ومنها NUL الذي يرفضه PostgreSQL) لا مكان لها في اسم
  if (CONTROL.test(cleaned) || !LETTER.test(cleaned)) {
    return err(nameError("buyer.name_invalid"));
  }
  return ok(cleaned as BuyerName);
}

/** يتحقق من الاسم والجوال معًا ويرجع كل أخطاء الحقول دفعة واحدة. */
export function parseBuyer(input: {
  readonly name: string;
  readonly mobile: string;
}): Result<Buyer, readonly DomainError[]> {
  const name = parseBuyerName(input.name);
  const mobile = parseSaudiMobile(input.mobile);
  if (name.ok && mobile.ok) {
    return ok({ name: name.value, mobile: mobile.value });
  }
  const errors = [name, mobile].flatMap((result) => (result.ok ? [] : [result.error]));
  return err(errors);
}
