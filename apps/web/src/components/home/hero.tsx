import { ButtonLink } from "@/components/ui/button-link";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { HeroTrack } from "./hero-track";

interface HeroProps {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

export function Hero({ locale, dictionary }: HeroProps) {
  return (
    <section className="surface-asphalt relative isolate overflow-hidden">
      <HeroTrack />
      <div className="page-container relative min-h-[34rem] pt-14 pb-56 md:min-h-[42rem] md:pt-24 md:pb-64">
        <h1 className="text-display font-display">{dictionary.hero.title}</h1>
        <p className="text-muted mt-6 max-w-prose text-lead">{dictionary.hero.lead}</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <ButtonLink href="#plans">{dictionary.hero.primary}</ButtonLink>
          <ButtonLink href={`${localizedPath(locale)}#location`} variant="secondary">
            {dictionary.hero.secondary}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
