/** اسم المتصفح والنظام من ترويسة User-Agent، لقائمة «جلساتي». تقريبي عمدًا: للتعرّف لا للأمان. */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

function firstMatch(table: readonly (readonly [RegExp, string])[], text: string): string | null {
  return table.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** «Chrome · Windows»، أو null حين لا يُعرف شيء. الترتيب مهم: Edge و Opera يذكران Chrome أيضًا. */
export function describeUserAgent(userAgent: string): string | null {
  const parts = [firstMatch(BROWSERS, userAgent), firstMatch(SYSTEMS, userAgent)];
  const known = parts.filter((part) => part !== null);
  return known.length === 0 ? null : known.join(" · ");
}
