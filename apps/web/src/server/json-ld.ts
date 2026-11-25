/** قيمة JSON صالحة: البيانات المنظَّمة لا تحمل دوالّ ولا undefined ولا تواريخ كائنات. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = Readonly<Record<string, JsonValue>>;

/**
 * JSON-LD آمن داخل وسم <script>: «<» و«>» و«&» تُكتب بترميز ‎\u‎ فلا يستطيع نص في المحتوى
 * أن يغلق الوسم (‎</script>‎) أو يفتح تعليق HTML. الناتج ما زال JSON صحيحًا بالقيم نفسها.
 */
export function serializeJsonLd(data: JsonObject): string {
  return JSON.stringify(data)
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026");
}
