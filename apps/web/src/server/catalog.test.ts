import { afterEach, describe, expect, it, vi } from "vitest";

const listMembershipPlans = vi.fn();
vi.mock("@masar/db", () => ({ listMembershipPlans }));
vi.mock("./db", () => ({ getDb: () => ({}) }));
// خارج عرض React الدالة تعمل بلا ذاكرة مؤقتة؛ نثبّت ذلك صراحةً ليبقى كل اختبار مستقلًا
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

const { CatalogUnavailableError, getMembershipPlan, getMembershipPlans } =
  await import("./catalog");

afterEach(() => {
  vi.restoreAllMocks();
  listMembershipPlans.mockReset();
});

describe("getMembershipPlans", () => {
  it("عطل القاعدة يُسجَّل منقّحًا ويُرمى خطأ عام بلا رسالة Prisma", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const prismaError = Object.assign(
      new Error("Invalid `db.product.findMany()` slug: \u0000secret-value"),
      {
        name: "PrismaClientKnownRequestError",
        code: "P2010",
      },
    );
    listMembershipPlans.mockRejectedValue(prismaError);

    const failure = await getMembershipPlans().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CatalogUnavailableError);
    expect((failure as Error).message).toBe("catalog.unavailable");
    expect((failure as Error).cause).toBeUndefined();

    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = String(errorLog.mock.calls[0]?.[0]);
    expect(line).toContain("catalog.read_failed");
    expect(line).toContain("P2010");
    expect(line).not.toContain("secret-value");
  });
});

describe("getMembershipPlan", () => {
  it("يبحث في القائمة المحمَّلة: معرّف الزائر لا يُمرَّر إلى القاعدة", async () => {
    listMembershipPlans.mockResolvedValue([{ slug: "one-year" }, { slug: "one-month" }]);
    expect(await getMembershipPlan("one-month")).toEqual({ slug: "one-month" });
    expect(await getMembershipPlan("\u0000")).toBeUndefined();
    expect(await getMembershipPlan("no-such")).toBeUndefined();
    for (const call of listMembershipPlans.mock.calls) {
      expect(call).toHaveLength(2); // (db, now) فقط
    }
  });
});
