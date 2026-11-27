import { Fragment } from "react";

/** فاصل الأسماء في النص العربي: فاصلة عربية لا «و» تلتصق بالاسم اللاتيني فتقلب قراءته. */
const ARABIC_SEPARATOR = "، ";

/**
 * أسماء علامات لاتينية داخل نص عربي أو إنجليزي (القرار 89): كل اسم معزول بـ`bdi`، والفاصل بلغة الصفحة،
 * فلا يقلب اتجاهُ اسمٍ ترتيبَ ما حوله («Google، Meta» لا «Metag Google»).
 */
export function ProviderNames({
  names,
  locale,
}: {
  readonly names: readonly string[];
  readonly locale: string;
}) {
  if (locale === "ar") {
    return (
      <>
        {names.map((name, index) => (
          <Fragment key={name}>
            {index === 0 ? null : ARABIC_SEPARATOR}
            <bdi>{name}</bdi>
          </Fragment>
        ))}
      </>
    );
  }
  const parts = new Intl.ListFormat(locale, { type: "conjunction" }).formatToParts(names);
  return (
    <>
      {parts.map((part, index) =>
        part.type === "element" ? <bdi key={index}>{part.value}</bdi> : part.value,
      )}
    </>
  );
}
