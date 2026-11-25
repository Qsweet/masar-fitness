/** ملاحظة صفحة السلة بعد إجراء (معامل `note` في الرابط)، تُعرض بـrole="status". */
export const CART_NOTES = ["added", "removed", "busy", "unavailable"] as const;
export type CartNote = (typeof CART_NOTES)[number];

export function parseCartNote(value: string | string[] | undefined): CartNote | undefined {
  return CART_NOTES.find((note) => note === value);
}
