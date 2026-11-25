/**
 * إنهاء الطلبات المعلّقة التي بلغت مهلتها، بدفعات حتى لا يبقى مستحق. يُشغَّل بمؤقت systemd أو cron
 * عند النشر: `pnpm --filter @masar/db orders:expire`. الصحة لا تعتمد عليه (انظر expire-orders.ts).
 */
import { createDb } from "../src/client";
import { EXPIRE_BATCH_SIZE, expireAllDueOrders } from "../src/commerce/expire-orders";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error("DATABASE_URL is required.");
}

const db = createDb(url);
const total = await expireAllDueOrders(db, { now: new Date(), limit: EXPIRE_BATCH_SIZE }).finally(
  () => db.$disconnect(),
);
process.stdout.write(`Expired ${String(total)} overdue orders.\n`);
