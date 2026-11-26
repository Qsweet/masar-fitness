/** إعادة ضبط التحقق بخطوتين للمالك: `pnpm admin:reset-owner-mfa`. */
import { runResetOwnerMfa } from "../../src/staff/cli/owner-commands";
import { runOwnerCommand } from "./run";

await runOwnerCommand(runResetOwnerMfa);
