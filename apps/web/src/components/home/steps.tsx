import type { Dictionary } from "@/i18n/dictionaries";

/** الخطوات تسلسل فعلي (اختيار ثم اشتراك ثم حضور)، لذلك تُرقَّم. */
export function Steps({ dictionary }: { readonly dictionary: Dictionary }) {
  return (
    <section aria-labelledby="steps-title" className="surface-light py-16 md:py-24">
      <div className="page-container">
        <h2 id="steps-title" className="max-w-prose text-title font-display">
          {dictionary.steps.title}
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {dictionary.steps.items.map((step, index) => (
            <li key={step.name} className="rule border-t pt-5">
              <p className="text-numeral font-display" aria-hidden="true">
                {index + 1}
              </p>
              <h3 className="mt-2 text-heading font-strong">{step.name}</h3>
              <p className="text-muted mt-1">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
