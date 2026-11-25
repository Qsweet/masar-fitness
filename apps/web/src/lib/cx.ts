/** يجمع أسماء أصناف CSS ويتجاهل الفارغ (أصناف CSS Modules قد تكون غير معرَّفة في الأنواع). */
export function cx(...names: readonly (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
