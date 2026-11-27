/**
 * ترتيب الشرائح (ADMIN_A3_SLIDER §4): ترتيب كثيف `0..n-1` يُعاد كتابته كله تحت قفل المحتوى، فلا
 * فجوات ولا تكرار مهما تزامن التحريك والإزالة.
 */
export const MOVE_DIRECTIONS = ["up", "down"] as const;
export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

export function isMoveDirection(value: string): value is MoveDirection {
  return MOVE_DIRECTIONS.some((direction) => direction === value);
}

/** الترتيب بعد تحريك شريحة خطوة؛ null إن لم توجد أو كانت على الحافة (لا تغيير). */
export function moveSlide(
  ids: readonly string[],
  id: string,
  direction: MoveDirection,
): string[] | null {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) {
    return null;
  }
  const next = [...ids];
  next[from] = ids[to] ?? id;
  next[to] = id;
  return next;
}

/** الترتيب الكثيف لقائمة مرتبة: المعرّف ← موضعه. */
export function densePositions(ids: readonly string[]): ReadonlyMap<string, number> {
  return new Map(ids.map((id, index) => [id, index]));
}
