/**
 * عدّة إطلاق الشريط: `pnpm slider:launch-kit` (على الخادم: docs/DEPLOYMENT.md). يستورد صور العدّة بخط
 * الرفع نفسه وينشئ شرائحها في المسودة ولا ينشر (docs/SLIDER_KIT.md §3). يُشغَّل بشرط `react-server`
 * ليقبل وحدات الخادم (`server-only`) خارج Next. رمز الخروج 0 عند النجاح، و1 عند الرفض.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SLIDE_KIT_DIR } from "@/content/slider-kit/kit";
import { clubTimezone } from "@/server/admin/content/timezone";
import { knownSlidePaths } from "@/server/content/slider-links";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { runLaunchKit } from "@/server/slider-kit/launch-kit";
import { kitMessage } from "@/server/slider-kit/messages";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXIT_REFUSED = 1;

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const env = getEnv();
  const db = getDb();
  try {
    const outcome = await runLaunchKit({
      db,
      media: { uploads: env.MEDIA_UPLOADS, root: env.MEDIA_DIR },
      imagesDir: join(WEB_ROOT, SLIDE_KIT_DIR),
      context: async (clubId) => ({
        knownPaths: await knownSlidePaths(),
        timeZone: await clubTimezone(clubId),
      }),
      now: new Date(),
    });
    if (!outcome.ok) {
      print(outcome.error);
      process.exitCode = EXIT_REFUSED;
      return;
    }
    outcome.value.created.forEach((id) => {
      print(kitMessage("created", { id }));
    });
    outcome.value.skipped.forEach((id) => {
      print(kitMessage("skipped", { id }));
    });
    print(kitMessage("done"));
  } finally {
    await db.$disconnect();
  }
}

await main();
