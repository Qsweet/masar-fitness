import { Logo } from "@/components/ui/logo";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import styles from "./brand-mark.module.css";

/** أقصى ارتفاع للشعار داخل مربعه بالبكسل (لاختيار حجم الصورة). */
const LOGO_HEIGHT = 40;

/**
 * علامة النادي: الشعار الأصلي داخل مربع داكن مستدير (صُمّم الشعار لخلفية داكنة، فلا يُعدَّل)، وبجانبه
 * الاسم مكتوبًا وكلمته الثانية بالتدرّج. الشعار زخرفي هنا لأن الاسم المكتوب بجانبه يسمّي النادي.
 */
export function BrandMark({
  dictionary,
  onDark = false,
  preload = false,
}: {
  readonly dictionary: Dictionary;
  readonly onDark?: boolean;
  readonly preload?: boolean;
}) {
  const [first, second] = dictionary.club.wordmark;
  return (
    <span className={cx(styles.mark, onDark && styles.onDark)}>
      <span className={styles.tile}>
        <Logo height={LOGO_HEIGHT} cssHeight="100%" alt="" preload={preload} />
      </span>
      <span className={styles.word}>
        {first} <span className="gradient-text">{second}</span>
      </span>
    </span>
  );
}
