import type { ContentChange } from "@masar/domain";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { DiffRow } from "../ui/diff-row";
import { Badge } from "../ui/kit";
import { PathText } from "./entry-parts";
import styles from "./content.module.css";

interface DiffListProps {
  readonly changes: readonly ContentChange[];
  readonly text: AdminDictionary["content"];
}

const DIRECTIONS = { ar: "rtl", en: "ltr" } as const;

/** الفرق مجمّعًا بالمساحة: لكل نص ولغة القيمة المعروضة قبل وبعد. */
export function DiffList({ changes, text }: DiffListProps) {
  const groups = [...new Set(changes.map((change) => change.namespace))];
  return (
    <div className={styles.diff} data-testid="content-diff">
      {groups.map((namespace) => (
        <section key={namespace} className={styles.diffGroup}>
          <h3 className={styles.diffTitle}>{lookup(text.namespaces, namespace, namespace)}</h3>
          <ul className={styles.entries}>
            {changes
              .filter((change) => change.namespace === namespace)
              .map((change) => (
                <DiffRow
                  key={`${change.path}-${change.locale}`}
                  head={
                    <>
                      <PathText path={change.path} />
                      <Badge tone="info">{text.locales[change.locale]}</Badge>
                      <Badge>{text.diff.kinds[change.kind]}</Badge>
                    </>
                  }
                  beforeLabel={text.diff.before}
                  afterLabel={text.diff.after}
                  before={change.before}
                  after={change.after}
                  dir={DIRECTIONS[change.locale]}
                  lang={change.locale}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
