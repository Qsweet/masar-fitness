import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  createProduct,
  getCatalogProduct,
  staffActor,
  updateProductIdentity,
  type CatalogProductDetail,
  type Db,
} from "./index";
import { productDraft } from "./test-support/catalog-admin-fixtures";
import { createTestClub, TEST_NOW } from "./test-support/commerce-fixtures";
import {
  createDbClients,
  disconnectAll,
  failure,
  refusalReasons,
  testDatabaseUrl,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const MINUTE_MS = 60_000;
const RACE_ROUNDS = 8;
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

describe("createProduct", () => {
  it("منتج مسودة بنسخته الأولى ومزاياها وسطر تدقيق بلا مفتاح اسم", async () => {
    const product = await newProduct();
    expect(product).toMatchObject({
      status: "draft",
      kind: "membership",
      name: { ar: "باقة اختبار", en: "Test plan" },
      tier: { ar: "فئة الاختبار", en: "Test tier" },
      sortOrder: 3,
      sellable: false,
    });
    expect(product.versions).toHaveLength(1);
    expect(product.currentVersion).toMatchObject({
      price: { amountMinor: 90_000, currency: "SAR" },
      durationMonths: 3,
      bonusMonths: 1,
      validFrom: TEST_NOW,
      validUntil: null,
      benefits: [
        { ar: "المسبح", en: "Pool" },
        { ar: "الساونا", en: "Sauna" },
      ],
    });
    const [audit] = await db.auditLog.findMany({ where: { entityId: product.id } });
    expect(audit).toMatchObject({
      entityType: "product",
      action: "product_created",
      actor,
      toState: "draft",
      data: { slug: product.slug, kind: "membership", priceMinor: 90_000, durationMonths: 3 },
    });
    expect(Object.keys(audit?.data ?? {}).filter((key) => /name|phone|mobile/i.test(key))).toEqual(
      [],
    );
  });

  it("الإرسال الثاني بالمعرّف نفسه إعادة: لا منتج ثانٍ ولا سطر تدقيق ثانٍ", async () => {
    const productId = randomUUID();
    const draft = productDraft();
    const input = { productId, clubId, draft, actor, now: TEST_NOW };
    expect(unwrap(await createProduct(db, input))).toEqual({ productId, replayed: false });
    expect(unwrap(await createProduct(db, input))).toEqual({ productId, replayed: true });
    expect(await actions(productId)).toEqual(["product_created"]);
    expect(await db.productVersion.count({ where: { productId } })).toBe(1);
  });

  it("معرّف نصي مستعمل ⇒ catalog.slug_taken على الحقل، بمعرّف آخر أو بنادٍ آخر", async () => {
    const product = await newProduct();
    const draft = productDraft({ slug: product.slug });
    for (const club of [clubId, otherClubId]) {
      const taken = failure(
        await createProduct(db, {
          productId: randomUUID(),
          clubId: club,
          draft,
          actor,
          now: TEST_NOW,
        }),
      );
      expect(taken).toMatchObject({
        code: "conflict",
        reason: "catalog.slug_taken",
        field: "slug",
      });
    }
    // المعرّف نفسه بمعرّف نصي آخر ليس إعادة
    const other = failure(
      await createProduct(db, {
        productId: product.id,
        clubId,
        draft: productDraft(),
        actor,
        now: TEST_NOW,
      }),
    );
    expect(other.reason).toBe("catalog.slug_taken");
  });

  it("إضافة: بلا مدة ولا اسم فئة", async () => {
    const addon = await newProduct({ kind: "addon", durationMonths: "", bonusMonths: "" });
    expect(addon).toMatchObject({ kind: "addon", tier: null });
    expect(addon.currentVersion).toMatchObject({ durationMonths: null, bonusMonths: 0 });
  });
});

describe("updateProductIdentity", () => {
  it("يكتب الهوية وحدها ويدقّق الحقول المتغيرة، والنسخة لا تُمس", async () => {
    const product = await newProduct();
    const identity = productDraft({
      nameAr: "اسم جديد",
      tierAr: "",
      tierEn: "",
      sortOrder: "7",
    }).identity;
    const updated = unwrap(
      await updateProductIdentity(db, {
        productId: product.id,
        clubId,
        lockToken: product.lockToken,
        identity,
        actor,
        now: at(2),
      }),
    );
    expect(updated.changed).toEqual(["title_ar", "tier_ar", "tier_en", "sort_order"]);
    const after = await detailOf(product.id, at(3));
    expect(after).toMatchObject({ name: { ar: "اسم جديد" }, tier: null, sortOrder: 7 });
    expect(after.versions).toHaveLength(1);
    expect(after.lockToken).not.toBe(product.lockToken);
    const audit = await db.auditLog.findFirst({
      where: { entityId: product.id, action: "product_updated" },
    });
    expect(audit?.data).toEqual({
      slug: product.slug,
      changed: "title_ar,tier_ar,tier_en,sort_order",
    });
  });

  it("لا فرق ⇒ لا كتابة ولا تدقيق، والرمز يبقى صالحًا", async () => {
    const product = await newProduct();
    const identity = productDraft().identity;
    const input = {
      productId: product.id,
      clubId,
      lockToken: product.lockToken,
      identity,
      actor,
      now: at(2),
    };
    expect(unwrap(await updateProductIdentity(db, input))).toEqual({ changed: [] });
    expect(await actions(product.id)).toEqual(["product_created"]);
    expect((await detailOf(product.id)).lockToken).toBe(product.lockToken);
  });

  it("رمز قفل قديم ⇒ catalog.stale_edit بلا دمج، ومنتج نادٍ آخر غير موجود", async () => {
    const product = await newProduct();
    const base = { productId: product.id, clubId, lockToken: product.lockToken, actor, now: at(2) };
    unwrap(
      await updateProductIdentity(db, {
        ...base,
        identity: productDraft({ nameAr: "الأول" }).identity,
      }),
    );
    const stale = failure(
      await updateProductIdentity(db, {
        ...base,
        identity: productDraft({ nameAr: "الثاني" }).identity,
      }),
    );
    expect(stale).toMatchObject({ code: "conflict", reason: "catalog.stale_edit" });
    expect((await detailOf(product.id)).name.ar).toBe("الأول");
    const foreign = failure(
      await updateProductIdentity(db, {
        ...base,
        clubId: otherClubId,
        identity: productDraft().identity,
      }),
    );
    expect(foreign).toMatchObject({ code: "not_found", reason: "catalog.product_not_found" });
  });

  it("تعديلان متزامنان بالرمز نفسه: واحد ينجح والآخر يُرفض", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const product = await newProduct();
      const attempt = (client: Db, nameAr: string) =>
        updateProductIdentity(client, {
          productId: product.id,
          clubId,
          lockToken: product.lockToken,
          identity: productDraft({ nameAr }).identity,
          actor,
          now: at(2),
        });
      const results = await Promise.all([attempt(db, "موظف أول"), attempt(other, "موظف ثانٍ")]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(refusalReasons(results)).toEqual(["catalog.stale_edit"]);
      expect(
        (await actions(product.id)).filter((action) => action === "product_updated"),
      ).toHaveLength(1);
    }
  });
});
