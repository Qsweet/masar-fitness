"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { AdminIcon } from "../admin-icon";
import {
  paletteGroups,
  type CommandEntry,
  type CommandScope,
  type PaletteGroup,
} from "./command-model";
import styles from "./palette.module.css";
import { readRecent } from "./recent-store";
import shellStyles from "./shell.module.css";

type PaletteText = AdminDictionary["shell"]["palette"];

interface CommandPaletteProps {
  readonly onClose: () => void;
  readonly entries: readonly CommandEntry[];
  /** مفاتيح الانتقال بحرفين لكل صفحة بمعرّف مدخلها («G O»)، تُعرض بجانبها. */
  readonly chords: Readonly<Record<string, string>>;
  readonly text: PaletteText;
}

const SCOPES: readonly CommandScope[] = ["all", "page", "action"];

function nextScope(scope: CommandScope, step: 1 | -1): CommandScope {
  const index = SCOPES.indexOf(scope);
  return SCOPES[(index + step + SCOPES.length) % SCOPES.length] ?? "all";
}

/**
 * الحوار يُرسم حين يُفتح فقط: يُعرض نافذةً عند التركيب، ويعيد التركيز عند الإزالة إلى ما كان عليه قبل
 * الفتح (زر البحث أو حيث ضُغط ⌘K).
 */
export function useModalOnMount() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, []);
  return dialog;
}

interface OptionsProps {
  readonly groups: readonly PaletteGroup[];
  readonly flat: readonly CommandEntry[];
  readonly active: number;
  readonly idOf: (index: number) => string;
  readonly chords: Readonly<Record<string, string>>;
  readonly text: PaletteText;
  readonly onPick: (entry: CommandEntry) => void;
  readonly onHover: (index: number) => void;
}

function Options({ groups, flat, active, idOf, chords, text, onPick, onHover }: OptionsProps) {
  const baseId = useId();
  return groups.map((group) => (
    <li key={group.kind} role="presentation">
      <div id={`${baseId}-${group.kind}`} className={styles.groupLabel}>
        {text.groups[group.kind]}
      </div>
      <ul role="group" aria-labelledby={`${baseId}-${group.kind}`} className={styles.groupList}>
        {group.entries.map((entry) => {
          const index = flat.indexOf(entry);
          const chord = chords[entry.id];
          return (
            <li
              key={entry.id}
              id={idOf(index)}
              role="option"
              aria-selected={index === active}
              className={styles.option}
              onClick={() => {
                onPick(entry);
              }}
              onPointerMove={() => {
                onHover(index);
              }}
            >
              <span className={styles.optionIcon} aria-hidden="true">
                <AdminIcon name={entry.icon} size={16} />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{entry.label}</span>
                <span className={styles.optionHint}>{entry.hint}</span>
              </span>
              {chord === undefined ? null : (
                <span className={shellStyles.keys} aria-hidden="true">
                  {chord.split(" ").map((key) => (
                    <kbd key={key} className={shellStyles.kbd}>
                      {key}
                    </kbd>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  ));
}

function Footer({ text }: { readonly text: PaletteText }) {
  const hint = (keys: readonly string[], label: string) => (
    <span className={styles.footHint}>
      {keys.map((key) => (
        <kbd key={key} className={shellStyles.kbd}>
          {key}
        </kbd>
      ))}
      {label}
    </span>
  );
  return (
    <div className={styles.foot} aria-hidden="true">
      {hint(["↑", "↓"], text.hints.move)}
      {hint(["↵"], text.hints.open)}
      {hint(["Tab"], text.hints.scope)}
      {hint(["Esc"], text.hints.close)}
      <span className={styles.footNote}>{text.scopeNote}</span>
    </div>
  );
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

function ScopeChips({ state, text }: { readonly state: PaletteState; readonly text: PaletteText }) {
  return (
    <div className={styles.scopes} role="group" aria-label={text.scopesLabel}>
      {SCOPES.map((item) => (
        <button
          key={item}
          type="button"
          tabIndex={-1}
          className={styles.scope}
          aria-pressed={item === state.scope}
          onClick={() => {
            state.rescope(item);
          }}
        >
          {text.scopes[item]}
        </button>
      ))}
    </div>
  );
}

interface PaletteInputProps {
  readonly state: PaletteState;
  readonly text: PaletteText;
  readonly listId: string;
  readonly activeId: string | undefined;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onClose: () => void;
}

function PaletteInput({ state, text, listId, activeId, onKeyDown, onClose }: PaletteInputProps) {
  return (
    <div className={styles.inputRow}>
      <AdminIcon name="search" />
      <input
        className={styles.input}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={text.input}
        placeholder={text.input}
        autoComplete="off"
        spellCheck={false}
        value={state.query}
        onChange={(event) => {
          state.search(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      <button type="button" tabIndex={-1} className={shellStyles.kbd} onClick={onClose}>
        <span className="sr-only">{text.close} </span>
        Esc
      </button>
    </div>
  );
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
      window.location.assign(entry.href);
    } else {
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
        {fill(text.results, { count: String(state.flat.length) })}
      </p>
      <Footer text={text} />
    </dialog>
  );
}
