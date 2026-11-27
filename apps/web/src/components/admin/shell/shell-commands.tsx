"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import {
  COLLAPSE_ATTRIBUTE,
  COMMAND_EVENT,
  PAGE_SEARCH_ATTRIBUTE,
  type ShellCommand,
} from "./attributes";
import { rememberRecent, type CommandEntry } from "./command-model";
import { CommandPalette } from "./command-palette";
import type { NavKey } from "./nav-model";
import { readRecent, writeRecent } from "./recent-store";
import { ShortcutsDialog } from "./shortcuts-dialog";
import {
  CHORD_TIMEOUT_MS,
  chordLabels,
  isTypingTarget,
  shortcutFor,
  type ShortcutAction,
} from "./shortcuts";

interface ShellCommandsProps {
  readonly entries: readonly CommandEntry[];
  /** وجهات `G` ثم حرف المتاحة لهذا الموظف فقط (ما لا يملكه لا يصل هنا). */
  readonly targets: Readonly<Partial<Record<NavKey, string>>>;
  readonly shortcutsEnabled: boolean;
  readonly text: AdminDictionary["shell"];
}

/** حقل البحث في الصفحة إن وُجد ظاهرًا. */
function pageSearch(): HTMLElement | null {
  const field = document.querySelector<HTMLElement>(`[${PAGE_SEARCH_ATTRIBUTE}]`);
  return field !== null && field.offsetParent !== null ? field : null;
}

/** يفتح اللوحة أو الحوار حين يطلبه زر في الهيكل (`CommandTrigger`). */
function useCommandEvents(open: (command: ShellCommand) => void): void {
  useEffect(() => {
    const listener = (event: Event) => {
      const detail: unknown = event instanceof CustomEvent ? event.detail : null;
      if (detail === "palette" || detail === "help") {
        open(detail);
      }
    };
    window.addEventListener(COMMAND_EVENT, listener);
    return () => {
      window.removeEventListener(COMMAND_EVENT, listener);
    };
  }, [open]);
}

/** «الأخيرة»: كل صفحة من مدخلات اللوحة تُفتح تُحفظ رابطًا في هذا المتصفح (تقرؤه اللوحة عند فتحها). */
function useRememberRecent(entries: readonly CommandEntry[]): void {
  const pathname = usePathname();
  useEffect(() => {
    if (entries.some((entry) => entry.kind === "page" && entry.href === pathname)) {
      writeRecent(rememberRecent(readRecent(), pathname));
    }
  }, [entries, pathname]);
}

function useShortcuts(enabled: boolean, run: (action: ShortcutAction) => void): void {
  const chordAt = useRef(0);
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) {
        return;
      }
      const chordPending = Date.now() - chordAt.current < CHORD_TIMEOUT_MS;
      const input = {
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        inField: isTypingTarget(event.target),
      };
      const action = shortcutFor(input, { enabled, chordPending });
      chordAt.current = action?.kind === "chord" ? Date.now() : 0;
      if (action !== null && action.kind !== "chord") {
        event.preventDefault();
        latest.current(action);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [enabled]);
}

/**
 * طبقة الأوامر فوق الهيكل: لوحة الأوامر، وحوار الاختصارات، ومستمع لوحة المفاتيح. تحسين فوق صفحات تعمل
 * بلا JavaScript (زر البحث رابط لصفحة البحث)، ولا منطق صلاحيات هنا: كل ما يصل حسبه الخادم.
 */
export function ShellCommands({ entries, targets, shortcutsEnabled, text }: ShellCommandsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<ShellCommand | null>(null);
  useRememberRecent(entries);
  useCommandEvents(setOpen);
  const run = (action: ShortcutAction) => {
    if (action.kind === "palette" || action.kind === "help") {
      setOpen(action.kind);
    } else if (action.kind === "search") {
      const field = pageSearch();
      if (field === null) {
        setOpen("palette");
      } else {
        field.focus();
      }
    } else if (action.kind === "sidebar") {
      document.querySelector<HTMLElement>(`[${COLLAPSE_ATTRIBUTE}]`)?.click();
    } else if (action.kind === "go" && targets[action.target] !== undefined) {
      router.push(targets[action.target] ?? "");
    }
  };
  useShortcuts(shortcutsEnabled, run);
  const chords = chordLabels(targets);
  const close = () => {
    setOpen(null);
  };
  return (
    <>
      {open === "palette" ? (
        <CommandPalette onClose={close} entries={entries} chords={chords} text={text.palette} />
      ) : null}
      {open === "help" ? (
        <ShortcutsDialog onClose={close} enabled={shortcutsEnabled} text={text} />
      ) : null}
    </>
  );
}
