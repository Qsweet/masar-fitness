/** تشغيل أمر مالك واحد على قاعدة `DATABASE_URL` بطرفية تفاعلية، ورمز خروج يعكس النتيجة. */
import { createDb, type Db } from "../../src/client";
import type { Terminal } from "../../src/staff/cli/owner-commands";
import { interactiveTerminal } from "./terminal";

type OwnerCommand = (db: Db, terminal: Terminal, now: Date) => Promise<boolean>;

const EXIT_REFUSED = 1;

export async function runOwnerCommand(command: OwnerCommand): Promise<void> {
  const terminal = interactiveTerminal();
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is required.");
  }
  const db = createDb(url);
  const done = await command(db, terminal, new Date()).finally(() => db.$disconnect());
  process.exitCode = done ? 0 : EXIT_REFUSED;
}
