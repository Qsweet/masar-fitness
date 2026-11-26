/**
 * طرفية أوامر المالك: تقرأ من لوحة المفاتيح مباشرة (TTY) فقط. كلمة المرور تُقرأ في الوضع الخام
 * فلا تظهر على الشاشة ولا تدخل سجل الصدفة، ولا تُقبل من وسيط ولا متغير بيئة ولا إدخال مُمرَّر.
 */
import { createInterface } from "node:readline/promises";
import { MESSAGES } from "../../src/staff/cli/messages";
import type { Terminal } from "../../src/staff/cli/owner-commands";

const EXIT_NOT_INTERACTIVE = 2;
const EXIT_INTERRUPTED = 130;
const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = new Set(["\u007f", "\b"]);
const ENTER = new Set(["\r", "\n"]);
const FIRST_PRINTABLE = " ";

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function ask(question: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await readline.question(question);
  } finally {
    readline.close();
  }
}

function askHidden(question: string): Promise<string> {
  const { stdin } = process;
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let typed = "";
    const finish = (): void => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        if (char === CTRL_C || char === CTRL_D) {
          finish();
          process.exit(EXIT_INTERRUPTED);
        } else if (ENTER.has(char)) {
          finish();
          resolve(typed);
          return;
        } else if (BACKSPACE.has(char)) {
          typed = Array.from(typed).slice(0, -1).join("");
        } else if (char >= FIRST_PRINTABLE) {
          typed += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

/** يرفض التشغيل بلا طرفية حقيقية: لا كلمة مرور من ملف أو أنبوب. */
export function interactiveTerminal(): Terminal {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(`${MESSAGES.notInteractive}\n`);
    process.exit(EXIT_NOT_INTERACTIVE);
  }
  return { ask, askHidden, print };
}
