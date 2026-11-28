/**
 * تفريغ معرّفات القياس بعد مدة الاحتفاظ (القرار 90-6): دورة واحدة لكل تشغيل، بمؤقت systemd يومي:
 * `pnpm --filter @masar/tracking tracking:purge`. يقرأ `DATABASE_URL` وحده، ولا يطبع قيمة ولا معرّفًا:
 * عدد ما فُرِّغ فقط. الدفعات محدودة، والإعادة بلا أثر، وما بقي تأخذه الدورة التالية.
 */
import { createDb, purgeExpiredTracking } from "@masar/db";

const EXIT_INVALID_CONFIG = 1;
const BATCH_SIZE = 500;
const MAX_BATCHES = 200;

const databaseUrl = process.env.DATABASE_URL ?? "";
if (databaseUrl === "") {
  process.stderr.write("DATABASE_URL is required.\n");
  process.exit(EXIT_INVALID_CONFIG);
}
const db = createDb(databaseUrl);
const summary = await purgeExpiredTracking(db, {
  now: new Date(),
  batchSize: BATCH_SIZE,
  maxBatches: MAX_BATCHES,
}).finally(() => db.$disconnect());
process.stdout.write(
  `${JSON.stringify({ event: "tracking.purge", ...summary, time: new Date().toISOString() })}\n`,
);
