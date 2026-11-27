/**
 * مرسِل التحويلات الخادمية (ADMIN_A5_TRACKING §4.1): دورة واحدة لكل تشغيل، بمؤقت systemd كل دقيقة:
 * `pnpm --filter @masar/tracking tracking:dispatch`. يقرأ البيئة نفسها التي يقرؤها الموقع
 * (`DATABASE_URL`، `ADMIN_SECRET_KEY`، `SITE_URL`)، ولا يطبع قيمة منها ولا حمولة.
 * `TRACKING_TRANSPORT=fake` (بيئة الاختبار) لا يرسل شيئًا إلى أي منصة.
 */
import { createDb } from "@masar/db";
import { createFakeTransport, fetchTransport, runDispatch, transportChoice } from "../src/index";

const EXIT_INVALID_CONFIG = 1;
const KEY_BYTES = 32;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(EXIT_INVALID_CONFIG);
}

const databaseUrl = process.env.DATABASE_URL ?? "";
const siteUrl = process.env.SITE_URL ?? "";
const adminKey = Buffer.from(process.env.ADMIN_SECRET_KEY ?? "", "base64");
if (databaseUrl === "" || siteUrl === "") {
  fail("DATABASE_URL and SITE_URL are required.");
}
if (adminKey.length !== KEY_BYTES) {
  fail(
    "ADMIN_SECRET_KEY must be 32 bytes in base64: tracking secrets cannot be opened without it.",
  );
}
const choice = transportChoice(process.env.TRACKING_TRANSPORT ?? "live", siteUrl);
if (!choice.ok) {
  fail(choice.error);
}
const transport = choice.value === "fake" ? createFakeTransport().transport : fetchTransport(fetch);
const db = createDb(databaseUrl);
const summary = await runDispatch({
  db,
  transport,
  adminKey: new Uint8Array(adminKey),
  siteUrl,
  clock: () => new Date(),
}).finally(() => db.$disconnect());
process.stdout.write(
  `${JSON.stringify({ event: "tracking.dispatch", ...summary, time: new Date().toISOString() })}\n`,
);
