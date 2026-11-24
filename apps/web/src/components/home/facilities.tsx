import type { Dictionary } from "@/i18n/dictionaries";

/** المرافق قائمة تحريرية لا شبكة بطاقات: الاسم عنوان كبير ووصفه سطر واحد. */
export function Facilities({ dictionary }: { readonly dictionary: Dictionary }) {
  return (
    <section aria-labelledby="facilities-title" className="surface-chalk py-20 md:py-28">
      <div className="page-container grid gap-10 md:grid-cols-12">
        <h2 id="facilities-title" className="text-title font-display md:col-span-5">
          {dictionary.facilities.title}
        </h2>
        <dl className="rule border-b md:col-span-6 md:col-start-7">
          {dictionary.facilities.items.map((item) => (
            <div
              key={item.name}
              className="rule grid gap-1 border-t py-6 md:grid-cols-2 md:items-baseline md:gap-6"
            >
              <dt className="text-heading font-strong">{item.name}</dt>
              <dd className="text-muted">{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
