import type { SliderChange } from "@masar/domain";
import { MediaPicture } from "@/components/ui/media-picture";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { Badge } from "../ui/kit";
import styles from "./slider.module.css";

type Text = AdminDictionary["slider"];

const KIND_TONES = {
  added: "success",
  removed: "danger",
  changed: "info",
  moved: "neutral",
  settings: "neutral",
} as const;

/** عنوان الشريحة في اللوحة: العنوان العربي، أو نصها البديل، أو «بلا عنوان». */
export function slideName(
  slide: { texts: { ar: { title: string } }; alt: { ar: string } },
  text: Text,
) {
  return slide.texts.ar.title || slide.alt.ar || text.list.untitled;
}

function ChangeRow({
  change,
  text,
  separator,
}: {
  change: SliderChange;
  text: Text;
  separator: string;
}) {
  if (change.kind === "settings") {
    return (
      <li className={styles.diffRow}>
        <span className={styles.diffName}>{text.diff.kinds.settings}</span>
        <span className={styles.diffFields}>
          {change.fields.map((field) => text.diff.fields[field]).join(separator)}
        </span>
      </li>
    );
  }
  return (
    <li className={styles.diffRow}>
      <MediaPicture
        image={change.slide.desktop}
        sizes="6rem"
        alt=""
        loading="lazy"
        className={styles.diffThumb}
      />
      <span className={styles.diffName}>
        {fill(text.list.position, { n: formatNumber(change.position + 1) })} ·{" "}
        <bdi>{slideName(change.slide, text)}</bdi>
      </span>
      <Badge tone={KIND_TONES[change.kind]}>{text.diff.kinds[change.kind]}</Badge>
      {change.kind === "changed" ? (
        <span className={styles.diffFields}>
          {change.fields.map((field) => text.diff.fields[field]).join(separator)}
        </span>
      ) : null}
    </li>
  );
}

/** تغييرات الشريط في الفرق (ADMIN_A3_SLIDER §7): شريحة شريحة بمصغّرها ونوع تغييرها وحقوله. */
export function SliderDiff({
  changes,
  text,
  separator,
}: {
  readonly changes: readonly SliderChange[];
  readonly text: Text;
  readonly separator: string;
}) {
  return (
    <section className={styles.diff} data-testid="slider-diff">
      <h3 className={styles.diffTitle}>{text.diff.title}</h3>
      <ul className={styles.diffList}>
        {changes.map((change) => (
          <ChangeRow
            key={change.kind === "settings" ? "settings" : `${change.kind}-${change.slideId}`}
            change={change}
            text={text}
            separator={separator}
          />
        ))}
      </ul>
    </section>
  );
}
