import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { Card } from "../ui/kit";
import styles from "./content.module.css";

/**
 * تجاوزات في المسودة لم تعد تطابق الكود (مفتاح حُذف أو مُنع، أو تغيّرت عناصر أصله): لا تُنشر ولا
 * تُعاين، وتُعرض هنا ليُعاد تحريرها (ADMIN_A3_CONTENT §4.3).
 */
export function DroppedOverrides({
  dropped,
  text,
}: {
  readonly dropped: readonly string[];
  readonly text: AdminDictionary["content"];
}) {
  if (dropped.length === 0) {
    return null;
  }
  return (
    <Card
      title={fill(text.dropped.title, { count: formatNumber(dropped.length) })}
      description={text.dropped.lead}
      accent
    >
      <ul className={styles.droppedList} data-testid="dropped-overrides">
        {dropped.map((item) => (
          <li key={item}>
            <bdi className={styles.path}>{item}</bdi>
          </li>
        ))}
      </ul>
    </Card>
  );
}
