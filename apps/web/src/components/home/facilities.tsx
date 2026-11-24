import type { Dictionary } from "@/i18n/dictionaries";

/** ما يحصل عليه المشترك في سطر لكل مرفق: شريط واحد لا شبكة بطاقات. */
export function Facilities({ dictionary }: { readonly dictionary: Dictionary }) {
  return (
    <section
      aria-labelledby="facilities-title"
      className="surface-light surface-light-raised rule border-y py-12 md:py-16"
    >
      <div className="page-container">
        <h2 id="facilities-title" className="text-title font-display">
          {dictionary.facilities.title}
        </h2>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          {dictionary.facilities.items.map((item) => (
            <div key={item.name} className="rule border-t pt-4">
              <dt className="text-heading font-strong">{item.name}</dt>
              <dd className="text-muted text-small">{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
