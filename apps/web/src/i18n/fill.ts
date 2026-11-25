const PLACEHOLDER = /\{(\w+)\}/gu;

/**
 * يملأ قالب نص من القاموس: «نحو {amount} {unit}» ← القيم. تمريرة واحدة، فالقيمة التي تشبه
 * مفتاحًا لا يُعاد تفسيرها. المفتاح غير الموجود يبقى كما هو.
 */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER, (match, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? match) : match,
  );
}

/**
 * مثل fill لكن القيم عناصر (مثل ‎<bdi>‎ لعزل اتجاه نص بلغة أخرى). يرجع أجزاء تُعرض متتالية.
 * المفتاح غير الموجود يبقى نصه كما هو.
 */
export function fillNodes<T>(
  template: string,
  values: Readonly<Record<string, T | string>>,
): (T | string)[] {
  return template
    .split(/(\{\w+\})/u)
    .filter((part) => part !== "")
    .map((part) => {
      const key = /^\{(\w+)\}$/u.exec(part)?.[1];
      return key !== undefined && Object.hasOwn(values, key) ? (values[key] ?? part) : part;
    });
}
