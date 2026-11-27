import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createOrder, type Db } from "./index";
import { createPlan, createTestClub, TEST_NOW } from "./test-support/commerce-fixtures";
import {
  createDbClients,
  disconnectAll,
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

/**
 * مراجعة A2: `createOrder` يقرأ السلة قبل قفل النسخ. معاملة لوحة تمسك قفل النسخة وتغلقها أو تخفي
 * منتجها؛ الطلب الذي ينتظر القفل يعيد القراءة تحته فلا يُختم على ما لم يعد يُباع.
 */
const MINUTE_MS = 60_000;
const at = (minutes: number): Date => new Date(TEST_NOW.getTime() + minutes * MINUTE_MS);
const ORDER_REACHES_LOCK_MS = 300;

let db: Db;
let other: Db;
let clubId: string;
let phoneIndex = 900;

function nextBuyer() {
  phoneIndex += 1;
  return testBuyer(testPhone(phoneIndex));
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

/** معاملة لوحة تمسك قفل النسخة ثم تعتمد، والطلب يبدأ أثناءها فيقرأ ما قبلها وينتظر القفل. */
async function whileHeld(
  versionId: string,
  write: (tx: Parameters<Parameters<Db["$transaction"]>[0]>[0]) => Promise<unknown>,
  order: () => ReturnType<typeof createOrder>,
) {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let locked = (): void => undefined;
  const isLocked = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const admin = other.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM product_versions WHERE id = ${versionId}::uuid FOR UPDATE`;
      await write(tx);
      locked();
      await held;
    },
    { timeout: 10_000 },
  );
  await isLocked;
  const created = order();
  // الطلب يصل إلى قفل النسخة وينتظره قبل أن تعتمد اللوحة
  await new Promise((resolve) => setTimeout(resolve, ORDER_REACHES_LOCK_MS));
  release();
  await admin;
  return created;
}

describe("createOrder مع معاملة لوحة متزامنة", () => {
  it("سباق: نسخة أُغلقت في معاملة كان الطلب ينتظرها ⇒ لا يُختم عليها، والطلب يُرفض بالإجمالي الجديد", async () => {
    const plan = await createPlan(db, clubId, { priceMinor: 100_000, durationMonths: 3 });
    const closeAt = at(4);
    const created = await whileHeld(
      plan.versionId,
      async (tx) => {
        await tx.$executeRaw`
          UPDATE product_versions SET valid_until = ${closeAt} WHERE id = ${plan.versionId}::uuid`;
        await tx.$executeRaw`
          INSERT INTO product_versions
            (id, product_id, price_minor, currency, duration_months, bonus_months, valid_from)
          VALUES (${randomUUID()}::uuid, ${plan.productId}::uuid, 200000, 'SAR', 3, 0, ${closeAt})`;
      },
      () => createOrder(db, orderInput(plan.slug, 100_000, { buyer: nextBuyer(), now: at(5) })),
    );
    expect(failure(created)).toMatchObject({
      reason: "cart.price_changed",
      cause: { totalMinor: 200_000 },
    });
    expect(await db.orderItem.count({ where: { productVersionId: plan.versionId } })).toBe(0);
    // بالإجمالي الجديد يُختم على النسخة السارية
    unwrap(
      await createOrder(db, orderInput(plan.slug, 200_000, { buyer: nextBuyer(), now: at(5) })),
    );
    const item = await db.orderItem.findFirstOrThrow({ where: { productId: plan.productId } });
    expect(item.productVersionId).not.toBe(plan.versionId);
    expect(item.listPriceMinor).toBe(200_000);
  });

  it("سباق: منتج أُخفي في معاملة كان الطلب ينتظرها ⇒ cart.product_unavailable بلا طلب", async () => {
    const plan = await createPlan(db, clubId, { priceMinor: 100_000, durationMonths: 3 });
    const created = await whileHeld(
      plan.versionId,
      (tx) =>
        tx.$executeRaw`UPDATE products SET status = 'draft' WHERE id = ${plan.productId}::uuid`,
      () => createOrder(db, orderInput(plan.slug, 100_000, { buyer: nextBuyer(), now: at(5) })),
    );
    expect(failure(created).reason).toBe("cart.product_unavailable");
    expect(await db.orderItem.count({ where: { productId: plan.productId } })).toBe(0);
  });
});
