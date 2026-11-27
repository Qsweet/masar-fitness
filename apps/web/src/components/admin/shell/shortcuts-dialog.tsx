"use client";

import { useId } from "react";
import { ADMIN_SHORTCUTS_OFF } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { setShortcutsAction } from "@/server/admin/actions/preferences";
import { AdminIcon } from "../admin-icon";
import { useModalOnMount } from "./use-modal";
import styles from "./palette.module.css";
import shellStyles from "./shell.module.css";
import { SHORTCUT_LIST_KEYS, type ShortcutKey } from "./shortcuts";

type ShellText = AdminDictionary["shell"];

interface ShortcutsDialogProps {
  readonly onClose: () => void;
  readonly enabled: boolean;
  readonly text: ShellText;
}

/** أزرار الاختصار: «⌘ K» متجاوران، و«G ثم O» بكلمة بينهما. */
export function ShortcutKeys({ keys, then }: { keys: readonly string[]; then: string }) {
  const chord = keys.length === 2 && keys[0] === "G";
  return keys.map((key, index) => (
    <span key={key} className={shellStyles.keys}>
      {chord && index === 1 ? <span>{then}</span> : null}
      <kbd className={shellStyles.kbd}>{key}</kbd>
    </span>
  ));
}

export function ShortcutList({ text }: { readonly text: ShellText["shortcuts"] }) {
  const keys = Object.keys(SHORTCUT_LIST_KEYS) as ShortcutKey[];
  return (
    <dl className={styles.helpList}>
      {keys.map((key) => (
        <div key={key} className={styles.helpRow}>
          <dt>{text.items[key]}</dt>
          <dd dir="ltr">
            <ShortcutKeys keys={SHORTCUT_LIST_KEYS[key]} then={text.then} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * حوار `?`: الاختصارات، وتشغيلها أو إطفاؤها (WCAG 2.1.4، تفضيل في كوكي يقرؤه الخادم). ‎<dialog>‎
 * أصلي يُرسم حين يُفتح، ويعود التركيز إلى ما فتحه عند الإغلاق.
 */
export function ShortcutsDialog({ onClose, enabled, text }: ShortcutsDialogProps) {
  const dialog = useModalOnMount();
  const titleId = useId();
  const { shortcuts, shortcutsToggle } = text;
  return (
    <dialog ref={dialog} aria-labelledby={titleId} className={styles.dialog} onClose={onClose}>
      <div className={styles.helpBody}>
        <div className={styles.helpHead}>
          <div>
            <h2 id={titleId} className={styles.helpTitle}>
              {shortcuts.title}
            </h2>
            <p className={styles.helpLead}>{enabled ? shortcuts.lead : shortcuts.off}</p>
          </div>
          <button
            type="button"
            className={shellStyles.iconButton}
            aria-label={shortcuts.close}
            onClick={onClose}
          >
            <AdminIcon name="close" />
          </button>
        </div>
        <ShortcutList text={shortcuts} />
        <form action={setShortcutsAction}>
          <input type="hidden" name="shortcuts" value={enabled ? ADMIN_SHORTCUTS_OFF : "on"} />
          <button type="submit" className={styles.scope}>
            {enabled ? shortcutsToggle.off : shortcutsToggle.on}
          </button>
        </form>
      </div>
    </dialog>
  );
}
