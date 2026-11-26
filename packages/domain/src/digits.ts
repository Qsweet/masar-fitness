const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;
const DIGIT_COUNT = 10;
const ASCII_ZERO = 0x30;

/** يحوّل الأرقام العربية (٠-٩) والفارسية (۰-۹) إلى أرقام لاتينية، ويترك ما عداها كما هو. */
export function toAsciiDigits(input: string): string {
  let out = "";
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    const zero = [ARABIC_INDIC_ZERO, EASTERN_ARABIC_INDIC_ZERO].find(
      (base) => code >= base && code < base + DIGIT_COUNT,
    );
    out += zero === undefined ? char : String.fromCodePoint(ASCII_ZERO + (code - zero));
  }
  return out;
}
