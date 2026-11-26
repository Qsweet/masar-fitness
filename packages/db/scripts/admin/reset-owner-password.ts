/** كلمة مرور جديدة للمالك من الخادم: `pnpm admin:reset-owner-password`. */
import { runResetOwnerPassword } from "../../src/staff/cli/owner-commands";
import { runOwnerCommand } from "./run";

await runOwnerCommand(runResetOwnerPassword);
