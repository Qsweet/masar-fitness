import { Fragment } from "react";
import styles from "./content.module.css";

/** مسار النص بخط ثابت، ويلتف عند النقاط لا وسط الاسم. */
export function PathText({ path }: { readonly path: string }) {
  return (
    <span className={styles.path}>
      {path.split(".").map((segment, index) => (
        <Fragment key={`${String(index)}-${segment}`}>
          {index === 0 ? null : (
            <>
              .<wbr />
            </>
          )}
          {segment}
        </Fragment>
      ))}
    </span>
  );
}

/** العناصر النائبة كما يجب أن تبقى في النص. */
export function Placeholders({
  names,
  label,
}: {
  readonly names: readonly string[];
  readonly label: string;
}) {
  if (names.length === 0) {
    return null;
  }
  return (
    <ul className={styles.chips} aria-label={label}>
      {names.map((name) => (
        <li key={name} className={styles.chip}>
          {`{${name}}`}
        </li>
      ))}
    </ul>
  );
}
