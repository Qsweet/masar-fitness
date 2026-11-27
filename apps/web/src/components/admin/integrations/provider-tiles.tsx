import { ButtonLink, Badge, type Tone } from "@/components/admin/ui/kit";
import { integrationPath } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import type { ProviderCard, ProviderStatus } from "@/server/admin/integrations/view";
import styles from "./integrations.module.css";

const TONES: Readonly<Record<ProviderStatus, Tone>> = {
  enabled: "success",
  disabled: "neutral",
  notConfigured: "neutral",
  missingSecret: "warning",
};

/** المعرّفات العامة المحفوظة سطرًا واحدًا (لا مفتاح خادمي أبدًا). */
function ids(card: ProviderCard): string {
  return Object.values(card.view?.config ?? {}).join(" · ");
}

export function ProviderTiles({
  cards,
  dictionary,
}: {
  readonly cards: readonly ProviderCard[];
  readonly dictionary: AdminDictionary;
}) {
  const text = dictionary.integrations;
  return (
    <ul className={styles.tiles} data-testid="provider-tiles">
      {cards.map((card) => (
        <li key={card.provider} className={styles.tile}>
          <div className={styles.tileHead}>
            <h2 className={styles.tileName}>{text.providers[card.provider].name}</h2>
            <Badge tone={TONES[card.status]}>{text.statuses[card.status]}</Badge>
          </div>
          <p className={styles.tileLead}>{text.providers[card.provider].lead}</p>
          {ids(card) === "" ? null : (
            <p className={styles.tileIds} dir="ltr">
              {ids(card)}
            </p>
          )}
          <span className={styles.tileLink}>
            <ButtonLink
              href={integrationPath(card.provider)}
              label={`${text.form.title}: ${text.providers[card.provider].name}`}
            >
              {text.form.title}
            </ButtonLink>
          </span>
        </li>
      ))}
    </ul>
  );
}
