import type { LocalizedTexts } from "@masar/domain";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { Cell, DataTable } from "../ui/data-table";
import { Card } from "../ui/kit";
import { PathText } from "./entry-parts";
import styles from "./content.module.css";

interface LockedTextsProps {
  readonly items: readonly {
    readonly path: string;
    readonly defaults: LocalizedTexts;
    readonly reason: string;
  }[];
  readonly text: AdminDictionary["content"];
}

/** نصوص المساحة التي تبقى من الكود، ولكلٍّ سبب منعه من القاموس. */
export function LockedTexts({ items, text }: LockedTextsProps) {
  if (items.length === 0) {
    return null;
  }
  const { columns } = text.texts;
  return (
    <Card title={text.namespace.lockedTitle} description={text.namespace.lockedLead} flush>
      <DataTable
        caption={text.namespace.lockedTitle}
        columns={[columns.path, columns.default, text.namespace.reason]}
        testId="texts-locked"
      >
        {items.map((item) => (
          <tr key={item.path} id={`text-${item.path}`}>
            <Cell label={columns.path}>
              <PathText path={item.path} />
            </Cell>
            <Cell label={columns.default}>
              <span className={styles.defaults}>
                <span>{item.defaults.ar}</span>
                <bdi className={styles.defaultEn} dir="ltr">
                  {item.defaults.en}
                </bdi>
              </span>
            </Cell>
            <Cell label={text.namespace.reason} muted>
              {lookup(text.lockReasons, item.reason, text.lockReasons.notListed)}
            </Cell>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
