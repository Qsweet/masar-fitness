"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { countText } from "@/i18n/count";
import { paletteGroups, type CommandEntry, type CommandScope } from "./command-model";
import styles from "./palette.module.css";
import {
  Footer,
  Options,
  PaletteInput,
  SCOPES,
  ScopeChips,
  type PaletteText,
} from "./palette-parts";
import { useModalOnMount } from "./use-modal";
import { readRecent } from "./recent-store";
import { isComposingKey } from "./shortcuts";
import { requestLeave } from "../ui/leave-request";

interface CommandPaletteProps {
  readonly onClose: () => void;
  readonly entries: readonly CommandEntry[];
  /** مفاتيح الانتقال بحرفين لكل صفحة بمعرّف مدخلها («G O»)، تُعرض بجانبها. */
  readonly chords: Readonly<Record<string, string>>;
  readonly text: PaletteText;
}

function nextScope(scope: CommandScope, step: 1 | -1): CommandScope {
  const index = SCOPES.indexOf(scope);
  return SCOPES[(index + step + SCOPES.length) % SCOPES.length] ?? "all";
}

/** حالة البحث: العبارة والنطاق والخيار النشط. تبدأ من أولها مع كل فتح (الحوار يُركَّب من جديد). */
function usePaletteState(entries: readonly CommandEntry[]) {
  const [recent] = useState(readRecent);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<CommandScope>("all");
  const [active, setActive] = useState(0);
  const groups = useMemo(
    () => paletteGroups(entries, query, scope, recent),
    [entries, query, scope, recent],
  );
  const flat = useMemo(() => groups.flatMap((group) => group.entries), [groups]);
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  return {
    query,
    scope,
    groups,
    flat,
    activeIndex,
    setActive,
    search: (value: string) => {
      setQuery(value);
      setActive(0);
    },
    rescope: (next: CommandScope) => {
      setScope(next);
      setActive(0);
    },
  };
}

type PaletteState = ReturnType<typeof usePaletteState>;

/** لوحة المفاتيح في الحقل: الأسهم تنقل الخيار النشط، وEnter يفتحه، وTab يبدّل النطاق. */
function keyHandler(state: PaletteState, pick: (entry: CommandEntry) => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (isComposingKey(event.nativeEvent)) {
      return;
    }
    const { flat, activeIndex } = state;
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const current = flat[activeIndex];
    if (move !== undefined && flat.length > 0) {
      event.preventDefault();
      state.setActive((activeIndex + move + flat.length) % flat.length);
    } else if (event.key === "Enter" && current !== undefined) {
      event.preventDefault();
      pick(current);
    } else if (event.key === "Tab") {
      event.preventDefault();
      state.rescope(nextScope(state.scope, event.shiftKey ? -1 : 1));
    }
  };
}

/**
 * لوحة الأوامر ⌘K (ADMIN_REDESIGN §4.3): ‎<dialog>‎ أصلي (حبس التركيز وEsc والستار) ونمط ARIA
 * «combobox + listbox» بـ`aria-activedescendant`: التركيز يبقى في الحقل، والأسهم تنقل الخيار النشط،
 * وEnter يفتحه، وTab يبدّل النطاق، ومنطقة حية تعلن عدد النتائج. المدخلات حسبها الخادم بصلاحيات
 * الموظف؛ هنا ترشيح نصي فقط.
 */
export function CommandPalette(props: CommandPaletteProps) {
  const { onClose, entries, chords, text } = props;
  const dialog = useModalOnMount();
  const router = useRouter();
  const listId = useId();
  const state = usePaletteState(entries);
  const idOf = (index: number) => `${listId}-option-${String(index)}`;
  useEffect(() => {
    document.getElementById(idOf(state.activeIndex))?.scrollIntoView({ block: "nearest" });
  });
  const pick = (entry: CommandEntry) => {
    onClose();
    if (entry.fullLoad) {
      // تحميل كامل: حارس المغادرة يسأل عبر تحذير المتصفح نفسه
      window.location.assign(entry.href);
    } else if (requestLeave(entry.href)) {
      router.push(entry.href);
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-label={text.title}
      className={styles.dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <PaletteInput
        state={state}
        text={text}
        listId={listId}
        activeId={state.activeIndex < 0 ? undefined : idOf(state.activeIndex)}
        onKeyDown={keyHandler(state, pick)}
        onClose={onClose}
      />
      <ScopeChips state={state} text={text} />
      <ul id={listId} role="listbox" aria-label={text.title} className={styles.results}>
        <Options
          groups={state.groups}
          flat={state.flat}
          active={state.activeIndex}
          idOf={idOf}
          chords={chords}
          text={text}
          onPick={pick}
          onHover={state.setActive}
        />
      </ul>
      {state.flat.length === 0 ? <p className={styles.empty}>{text.empty}</p> : null}
      <p role="status" className="sr-only">
        {state.flat.length === 0 ? text.noResults : countText(state.flat.length, text.results)}
      </p>
      <Footer text={text} />
    </dialog>
  );
}
