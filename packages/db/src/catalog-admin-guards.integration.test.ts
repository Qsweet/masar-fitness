import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  createProduct,
  getCatalogProduct,
  setAddonLinks,
  staffActor,
  updateProductIdentity,
  type CatalogProductDetail,
  type Db,
} from "./index";
import { productDraft } from "./test-support/catalog-admin-fixtures";
import { createPlan, createTestClub, TEST_NOW } from "./test-support/commerce-fixtures";
import {
  createDbClients,
  disconnectAll,
  failure,
  testDatabaseUrl,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const MINUTE_MS = 60_000;
const at = (minutes: number): Date => new Date(TEST_NOW.getTime() + minutes * MINUTE_MS);

let db: Db;
let other: Db;
let clubId: string;
let otherClubId: string;
let actor: ReturnType<typeof staffActor>;

async function newProduct(
  change: Parameters<typeof productDraft>[0] = {},
): Promise<CatalogProductDetail> {
  const productId = randomUUID();
  unwrap(
    await createProduct(db, {
      productId,
      clubId,
      draft: productDraft(change),
      actor,
      now: TEST_NOW,
    }),
  );
  return detailOf(productId);
}

async function detailOf(productId: string, now = at(1)): Promise<CatalogProductDetail> {
  const detail = await getCatalogProduct(db, clubId, productId, now);
  if (detail === undefined) {
    throw new Error("المنتج غير موجود");
  }
  return detail;
}

function actions(productId: string): Promise<string[]> {
  return db.auditLog
    .findMany({ where: { entityId: productId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    .then((rows) => rows.map((row) => row.action));
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  actor = staffActor((await createTestStaff(db, clubId, { role: "manager" })).id);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

describe("محفّزات القاعدة بـSQL خام", () => {
  it("P1: المعرّف النصي والنوع والنادي ووقت الإنشاء ثابتة بعد الإنشاء", async () => {
    const product = await newProduct();
    const id = product.id;
    const attempts = [
      db.$executeRaw`UPDATE products SET slug = ${`${product.slug}-x`} WHERE id = ${id}::uuid`,
      db.$executeRaw`UPDATE products SET kind = 'addon' WHERE id = ${id}::uuid`,
      db.$executeRaw`UPDATE products SET club_id = ${otherClubId}::uuid WHERE id = ${id}::uuid`,
      db.$executeRaw`UPDATE products SET created_at = now() WHERE id = ${id}::uuid`,
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toThrow("product_identity_immutable");
    }
    await db.$executeRaw`UPDATE products SET name_ar = 'يتغير' WHERE id = ${id}::uuid`;
  });

  it("T5a ما زال يرفض تعديل شروط نسخة، واسم الفئة بلغة واحدة مرفوض", async () => {
    const product = await newProduct();
    const versionId = product.currentVersion?.id ?? "";
    await expect(
      db.$executeRaw`UPDATE product_versions SET price_minor = 1 WHERE id = ${versionId}::uuid`,
    ).rejects.toThrow("product_version_terms_immutable");
    await expect(
      db.$executeRaw`UPDATE products SET tier_en = NULL WHERE id = ${product.id}::uuid`,
    ).rejects.toThrow("products_tier_both_or_none");
    await expect(
      db.$executeRaw`UPDATE products SET tier_ar = ' ', tier_en = 'x' WHERE id = ${product.id}::uuid`,
    ).rejects.toThrow("products_tier_ar_length");
  });
});

describe("setAddonLinks", () => {
  it("يستبدل روابط الإضافة، ويدقّق المضاف والمحذوف، والإعادة بلا كتابة", async () => {
    const [first, second] = [await newProduct(), await newProduct()];
    const addon = await newProduct({ kind: "addon" });
    const base = { productId: addon.id, clubId, actor, now: at(2) };
    const linked = unwrap(
      await setAddonLinks(db, {
        ...base,
        lockToken: addon.lockToken,
        membershipIds: [first.id, second.id],
      }),
    );
    expect(linked).toEqual({ linked: 2, added: 2, removed: 0 });
    const afterLink = await detailOf(addon.id, at(3));
    expect(
      afterLink.links
        .filter((link) => link.linked)
        .map((link) => link.id)
        .sort(),
    ).toEqual([first.id, second.id].sort());
    const replaced = unwrap(
      await setAddonLinks(db, {
        ...base,
        lockToken: afterLink.lockToken,
        membershipIds: [second.id],
      }),
    );
    expect(replaced).toEqual({ linked: 1, added: 0, removed: 1 });
    const again = await detailOf(addon.id, at(3));
    expect(
      unwrap(
        await setAddonLinks(db, {
          ...base,
          lockToken: again.lockToken,
          membershipIds: [second.id],
        }),
      ),
    ).toEqual({
      linked: 1,
      added: 0,
      removed: 0,
    });
    expect(
      (await actions(addon.id)).filter((a) => a === "product_addon_links_updated"),
    ).toHaveLength(2);
  });

  it("يرفض غير الإضافة، وباقة من نادٍ آخر، ورمز قفل قديم", async () => {
    const plan = await newProduct();
    const addon = await newProduct({ kind: "addon" });
    const foreign = await createPlan(db, otherClubId, { priceMinor: 1_000, durationMonths: 1 });
    const base = { clubId, actor, now: at(2) };
    const notAddon = failure(
      await setAddonLinks(db, {
        ...base,
        productId: plan.id,
        lockToken: plan.lockToken,
        membershipIds: [],
      }),
    );
    expect(notAddon.reason).toBe("catalog.addon_links_invalid");
    const crossClub = failure(
      await setAddonLinks(db, {
        ...base,
        productId: addon.id,
        lockToken: addon.lockToken,
        membershipIds: [foreign.productId],
      }),
    );
    expect(crossClub.reason).toBe("catalog.addon_links_invalid");
    const stale = failure(
      await setAddonLinks(db, {
        ...base,
        productId: addon.id,
        lockToken: "0:none",
        membershipIds: [plan.id],
      }),
    );
    expect(stale.reason).toBe("catalog.stale_edit");
  });
});

describe("updateProductIdentity لمنتج منشور", () => {
  it("لا يُفرَّغ وصفه بأي لغة (تعريف موانع النشر نفسه)، والمسودة تُفرَّغ", async () => {
    const product = await newProduct();
    const emptied = (summaryEn: string, target: CatalogProductDetail) =>
      updateProductIdentity(db, {
        productId: target.id,
        clubId,
        lockToken: target.lockToken,
        identity: productDraft({ summaryEn }).identity,
        actor,
        now: at(2),
      });
    unwrap(await emptied("", product));
    await db.product.update({
      where: { id: product.id },
      data: { status: "active", summaryEn: "Summary" },
    });
    const published = await detailOf(product.id, at(3));
    expect(failure(await emptied("", published))).toMatchObject({
      reason: "catalog.texts_required_published",
      field: "summaryEn",
    });
    expect((await detailOf(product.id, at(3))).summary.en).toBe("Summary");
  });
});
