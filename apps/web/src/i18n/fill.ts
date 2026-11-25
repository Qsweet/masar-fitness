const PLACEHOLDER = /\{(\w+)\}/gu;

/**
 * يملأ قالب نص من القاموس: «حوالي {amount} {unit}» ← القيم. تمريرة واحدة، فالقيمة التي تشبه
 * مفتاحًا لا يُعاد تفسيرها. المفتاح غير الموجود يبقى كما هو.
 */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER, (match, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? match) : match,
  );
}
