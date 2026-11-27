"use client";

import type { KeyboardEvent } from "react";
import { useId } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { AdminIcon } from "../admin-icon";
import type { CommandEntry, CommandScope, PaletteGroup } from "./command-model";
import styles from "./palette.module.css";
import shellStyles from "./shell.module.css";

/** أجزاء لوحة الأوامر المرسومة: الخيارات بمجموعاتها، والتذييل، والنطاقات، والحقل. */
export type PaletteText = AdminDictionary["shell"]["palette"];

export const SCOPES: readonly CommandScope[] = ["all", "page", "action"];

export interface ScopeState {
  readonly scope: CommandScope;
  readonly query: string;
  readonly rescope: (scope: CommandScope) => void;
  readonly search: (query: string) => void;
}

export interface OptionsProps {
  readonly groups: readonly PaletteGroup[];
  readonly flat: readonly CommandEntry[];
  readonly active: number;
  readonly idOf: (index: number) => string;
  readonly chords: Readonly<Record<string, string>>;
  readonly text: PaletteText;
  readonly onPick: (entry: CommandEntry) => void;
  readonly onHover: (index: number) => void;
}

export function Options({
  groups,
  flat,
  active,
  idOf,
  chords,
  text,
  onPick,
  onHover,
}: OptionsProps) {
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

export function Footer({ text }: { readonly text: PaletteText }) {
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

export function ScopeChips({
  state,
  text,
}: {
  readonly state: ScopeState;
  readonly text: PaletteText;
}) {
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

export interface PaletteInputProps {
  readonly state: ScopeState;
  readonly text: PaletteText;
  readonly listId: string;
  readonly activeId: string | undefined;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onClose: () => void;
}

export function PaletteInput({
  state,
  text,
  listId,
  activeId,
  onKeyDown,
  onClose,
}: PaletteInputProps) {
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
