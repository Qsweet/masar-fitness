import type { Dictionary } from "@/i18n/dictionaries";

/** الخطوات تسلسل فعلي (اختيار ثم اشتراك ثم حضور)، لذلك تُرقَّم وتوصل بخط المسار. */
export function Steps({ dictionary }: { readonly dictionary: Dictionary }) {
  return (
    <section
      aria-labelledby="steps-title"
      className="surface-asphalt surface-asphalt-deep py-20 md:py-28"
    >
      <div className="page-container">
        <h2 id="steps-title" className="max-w-prose text-title font-display">
          {dictionary.steps.title}
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {dictionary.steps.items.map((step, index) => (
            <li key={step.name}>
              <svg
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="block h-3 w-full"
              >
                <line x1="0" y1="5" x2="100" y2="5" className="track-dash" />
              </svg>
              <p className="mt-5 text-numeral font-display text-lane-500" aria-hidden="true">
                {index + 1}
              </p>
              <h3 className="mt-3 text-heading font-strong">{step.name}</h3>
              <p className="text-muted mt-1">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
