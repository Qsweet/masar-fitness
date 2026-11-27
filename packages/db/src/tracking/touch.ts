import { decodeAttribution, encodeAttribution, type Touch } from "@masar/domain";

export type { Touch };

/** لمسة مخزّنة JSONB تمر بفحص المجال نفسه (نمط كل قيمة) قبل أن تُستعمل. */
export function decodeTouch(value: unknown): Touch | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const touch = value as Touch;
  return decodeAttribution(encodeAttribution({ first: touch, last: touch }))?.last ?? null;
}
