/** إنشاء أول مالك للوحة التحكم: `pnpm admin:create-owner` (على الخادم: docs/DEPLOYMENT.md). */
import { runCreateOwner } from "../../src/staff/cli/owner-commands";
import { runOwnerCommand } from "./run";

await runOwnerCommand(runCreateOwner);
