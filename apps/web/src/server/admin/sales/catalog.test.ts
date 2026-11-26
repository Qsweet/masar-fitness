import { DomainError, err, money, ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffContext } from "../session";
import { benefitField } from "./plan-form";

/** كتابات الكتالوج بقاعدة مستبدلة: أخطاء الحقول، وإعادة الإرسال، وخطوة المراجعة، وصلاحية النشر. */
const PRODUCT_ID = "018f4e2a-0000-7000-8000-0000000000b1";
const OWNER = { id: "018f4e2a-0000-7000-8000-000000000001", clubId: "club-1", role: "owner" };
const NOW = new Date("2026-06-15T09:00:00Z");

const VERSION = {
  id: "v1",
  price: money(90_000),
  durationMonths: 3,
  bonusMonths: 1,
  benefits: [{ ar: "المسبح", en: "Pool" }],
};
const product = { id: PRODUCT_ID, kind: "membership", status: "draft", currentVersion: VERSION };

const createProduct = vi.fn(() => Promise.resolve(ok({ productId: PRODUCT_ID, replayed: false })));
const getCatalogProduct = vi.fn((): Promise<unknown> => Promise.resolve(product));
const changeProductVersion = vi.fn(() =>
  Promise.resolve(ok({ written: "version", versionId: "v2" })),
);
const updateProductIdentity = vi.fn(() => Promise.resolve(ok({ changed: ["title_ar"] })));
const setProductStatus = vi.fn(() =>
  Promise.resolve(ok({ status: "active", replayed: false, lastSellable: false })),
);
const setAddonLinks = vi.fn(() => Promise.resolve(ok({ linked: 1, added: 1, removed: 0 })));
vi.mock("@masar/db", () => ({
  createProduct,
  getCatalogProduct,
  changeProductVersion,
  updateProductIdentity,
  setProductStatus,
  setAddonLinks,
  staffActor: (id: string) => `staff:${id}`,
}));
vi.mock("../../db", () => ({ getDb: () => ({}) }));

const { changePlanStatus, createPlan, savePlanIdentity, savePlanTerms } = await import("./catalog");

const owner = { staff: OWNER } as unknown as StaffContext;
const sales = { staff: { ...OWNER, role: "sales" } } as unknown as StaffContext;

const VALUES = {
  kind: "membership",
  slug: "six-months",
  nameAr: "6 أشهر",
  nameEn: "6 months",
  summaryAr: "",
  summaryEn: "",
  tierAr: "",
  tierEn: "",
  sortOrder: "0",
  price: "900",
  durationMonths: "3",
  bonusMonths: "1",
  [benefitField("ar", 0)]: "المسبح",
  [benefitField("en", 0)]: "Pool",
};

afterEach(() => {
  vi.clearAllMocks();
  getCatalogProduct.mockImplementation(() => Promise.resolve(product));
});

describe("createPlan", () => {
  it("مسودة صالحة تُكتب باسم الموظف في ناديه، بالسعر بالهللة", async () => {
    const created = await createPlan(owner, PRODUCT_ID, VALUES, NOW);
    expect(created).toEqual({ ok: true, value: PRODUCT_ID });
    expect(createProduct).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        productId: PRODUCT_ID,
        clubId: "club-1",
        actor: `staff:${OWNER.id}`,
      }),
    );
    const [, input] = createProduct.mock.calls[0] as unknown as [unknown, { draft: unknown }];
    expect(input.draft).toMatchObject({ slug: "six-months", terms: { priceMinor: 90_000 } });
  });

  it("أخطاء الحقول ترجع كلها بجانب حقولها، ولا كتابة", async () => {
    const refused = await createPlan(
      owner,
      PRODUCT_ID,
      { ...VALUES, price: "1,5", slug: "X Y" },
      NOW,
    );
    expect(refused).toEqual({
      ok: false,
      error: {
        error: null,
        fields: { slug: "catalog.slug_invalid", price: "amount.invalid_format" },
      },
    });
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("إعادة الإرسال بالمعرّف نفسه تنتهي بالمنتج نفسه", async () => {
    createProduct.mockResolvedValueOnce(ok({ productId: PRODUCT_ID, replayed: true }));
    expect(await createPlan(owner, PRODUCT_ID, VALUES, NOW)).toEqual({
      ok: true,
      value: PRODUCT_ID,
    });
  });

  it("المعرّف النصي المستعمل خطأ على حقله", async () => {
    createProduct.mockResolvedValueOnce(
      err(new DomainError("conflict", "catalog.slug_taken", { field: "slug" })) as never,
    );
    expect(await createPlan(owner, PRODUCT_ID, VALUES, NOW)).toEqual({
      ok: false,
      error: { error: null, fields: { slug: "catalog.slug_taken" } },
    });
  });
});

describe("savePlanTerms", () => {
  const edit = { productId: PRODUCT_ID, lockToken: "1:v1", values: { ...VALUES, price: "1000" } };

  it("المسودة تُحفظ مباشرة بلا مراجعة", async () => {
    const saved = await savePlanTerms(owner, { ...edit, intent: "save" }, NOW);
    expect(saved).toEqual({ ok: true, value: { kind: "saved", written: "version" } });
    expect(changeProductVersion).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ lockToken: "1:v1", canChangePublished: true }),
    );
  });

  it("المنتج المنشور: المراجعة أولًا ولا كتابة، ثم التأكيد يكتب", async () => {
    getCatalogProduct.mockImplementation(() => Promise.resolve({ ...product, status: "active" }));
    const review = await savePlanTerms(owner, { ...edit, intent: "save" }, NOW);
    expect(review).toMatchObject({
      ok: true,
      value: { kind: "review", terms: { priceMinor: 100_000 } },
    });
    expect(changeProductVersion).not.toHaveBeenCalled();
    const confirmed = await savePlanTerms(owner, { ...edit, intent: "confirm" }, NOW);
    expect(confirmed).toMatchObject({ ok: true, value: { kind: "saved" } });
    expect(changeProductVersion).toHaveBeenCalledTimes(1);
  });

  it("المنتج المنشور بلا تغيير: لا مراجعة ولا كتابة", async () => {
    getCatalogProduct.mockImplementation(() => Promise.resolve({ ...product, status: "active" }));
    const same = await savePlanTerms(owner, { ...edit, values: VALUES, intent: "save" }, NOW);
    expect(same).toEqual({ ok: false, error: { error: "catalog.no_changes", fields: {} } });
  });

  it("بلا صلاحية النشر: المنشور مرفوض قبل المراجعة، والقاعدة تُبلَّغ بغياب الصلاحية", async () => {
    getCatalogProduct.mockImplementation(() => Promise.resolve({ ...product, status: "active" }));
    const refused = await savePlanTerms(sales, { ...edit, intent: "save" }, NOW);
    expect(refused).toEqual({
      ok: false,
      error: { error: "catalog.publish_required", fields: {} },
    });
    getCatalogProduct.mockImplementation(() => Promise.resolve(product));
    await savePlanTerms(sales, { ...edit, intent: "save" }, NOW);
    expect(changeProductVersion).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ canChangePublished: false }),
    );
  });

  it("منتج غير موجود أو من نوع لا يُدار", async () => {
    for (const found of [undefined, { ...product, kind: "digital_program" }]) {
      getCatalogProduct.mockImplementation(() => Promise.resolve(found));
      const refused = await savePlanTerms(owner, { ...edit, intent: "save" }, NOW);
      expect(refused).toEqual({
        ok: false,
        error: { error: "catalog.product_not_found", fields: {} },
      });
    }
  });

  it("رمز قفل قديم يرجع كما هو من القاعدة", async () => {
    changeProductVersion.mockResolvedValueOnce(
      err(new DomainError("conflict", "catalog.stale_edit")) as never,
    );
    const stale = await savePlanTerms(owner, { ...edit, intent: "save" }, NOW);
    expect(stale).toEqual({ ok: false, error: { error: "catalog.stale_edit", fields: {} } });
  });
});

describe("savePlanIdentity و changePlanStatus", () => {
  it("الهوية: خطأ الحقل قبل أي كتابة، ونجاحها يقول هل تغيّر شيء", async () => {
    const edit = { productId: PRODUCT_ID, lockToken: "1:v1", values: { ...VALUES, nameEn: "" } };
    expect(await savePlanIdentity(owner, edit, NOW)).toEqual({
      ok: false,
      error: { error: null, fields: { nameEn: "catalog.name_length" } },
    });
    expect(updateProductIdentity).not.toHaveBeenCalled();
    expect(await savePlanIdentity(owner, { ...edit, values: VALUES }, NOW)).toEqual({
      ok: true,
      value: true,
    });
  });

  it("إجراء حالة مجهول يُرفض قبل أي قراءة", async () => {
    const change = {
      productId: PRODUCT_ID,
      lockToken: "1:v1",
      action: "delete",
      confirmLast: true,
    };
    expect(await changePlanStatus(owner, change, NOW)).toEqual({
      ok: false,
      error: { error: "sales.invalid_request", fields: {} },
    });
    expect(setProductStatus).not.toHaveBeenCalled();
    const archived = await changePlanStatus(owner, { ...change, action: "archive" }, NOW);
    expect(archived.ok).toBe(true);
    expect(setProductStatus).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ action: "archive", confirmLast: true, clubId: "club-1" }),
    );
  });
});
