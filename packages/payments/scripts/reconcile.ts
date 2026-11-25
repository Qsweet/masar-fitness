/**
 * مهمة مطابقة المدفوعات: تقرأ من المزوّد حالة المحاولات الحيّة وتسوّيها. تُشغَّل بمؤقت systemd أو
 * cron عند النشر: `pnpm --filter @masar/payments payments:reconcile`. جدولتها شرط قبل أي دفع حي.
 * تقرأ الإعداد من البيئة نفسها التي يقرؤها الموقع، ولا تطبع أي قيمة منه.
 */
import { createDb } from "@masar/db";
import {
  createProvider,
  parsePaymentsConfig,
  runReconcile,
  type PaymentLogEvent,
  type PaymentLogFields,
  type PaymentLogger,
} from "../src/index";

const EXIT_INVALID_CONFIG = 1;

function write(level: string, event: PaymentLogEvent, fields: PaymentLogFields = {}): void {
  const line = JSON.stringify({ ...fields, level, event, time: new Date().toISOString() });
  (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

const logger: PaymentLogger = {
  info: (event, fields) => {
    write("info", event, fields);
  },
  warn: (event, fields) => {
    write("warn", event, fields);
  },
  error: (event, fields) => {
    write("error", event, fields);
  },
};

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(EXIT_INVALID_CONFIG);
}

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  fail("DATABASE_URL is required.");
}
const parsed = parsePaymentsConfig(process.env);
if (!parsed.ok) {
  const problems = parsed.error.map((problem) => `${problem.variable}: ${problem.message}`);
  fail(`Invalid payments configuration:\n- ${problems.join("\n- ")}`);
}
const config = parsed.value;
if (config.mode === "off") {
  process.stdout.write("Payments are off: nothing to reconcile.\n");
} else if (config.provider === "fake") {
  // حالة مزوّد الاختبار في ذاكرة عملية الموقع: قراءتها من هنا تُظهر كل جلسة مفقودة
  fail("The fake provider lives inside the web process and cannot be reconciled from a script.");
} else {
  const db = createDb(databaseUrl);
  const clock = (): Date => new Date();
  const provider = createProvider(config, { fetch, clock });
  const deps = { db, provider, logger, clock, minPaymentMinutes: config.minPaymentMinutes };
  const run = await runReconcile(deps).finally(() => db.$disconnect());
  const summary = run.ran ? JSON.stringify(run.value) : "skipped: another cycle is running";
  process.stdout.write(`Payments reconcile ${summary}\n`);
}
