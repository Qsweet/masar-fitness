import { plainDate } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { ordersHref, parseOrdersQuery } from "./orders-query";

const TODAY = plainDate(2026, 6, 15);

describe("parseOrdersQuery", () => {
  it("بلا تصفية: كل الحالات، وآخر ثلاثين يومًا حتى اليوم، والصفحة الأولى", () => {
    expect(parseOrdersQuery({}, TODAY)).toEqual({
      tab: "all",
      from: plainDate(2026, 5, 17),
      to: TODAY,
      customRange: false,
      invalidRange: false,
      reference: null,
      page: 1,
    });
  });

  it("تبويب وصفحة ومدى كما كُتبت", () => {
    const filter = parseOrdersQuery(
      { tab: "awaiting", from: "2026-06-01", to: "2026-06-10", page: "3" },
      TODAY,
    );
    expect(filter).toMatchObject({
      tab: "awaiting",
      from: plainDate(2026, 6, 1),
      to: plainDate(2026, 6, 10),
      customRange: true,
      invalidRange: false,
      page: 3,
    });
  });

  it("طرف واحد من المدى يكمله الافتراضي", () => {
    const fromOnly = parseOrdersQuery({ from: "2026-06-10" }, TODAY);
    expect(fromOnly).toMatchObject({ from: plainDate(2026, 6, 10), to: TODAY, customRange: true });
    const toOnly = parseOrdersQuery({ to: "2026-06-10" }, TODAY);
    expect(toOnly).toMatchObject({ from: plainDate(2026, 5, 17), to: plainDate(2026, 6, 10) });
  });

  it.each([
    [{ from: "2026-13-01" }],
    [{ to: "15/06/2026" }],
    [{ from: "2026-02-30" }],
    [{ from: "2026-06-10", to: "2026-06-01" }],
    [{ from: "2026-06-16" }],
  ])("مدى غير صحيح %o لا يُستعلم", (query) => {
    expect(parseOrdersQuery(query, TODAY).invalidRange).toBe(true);
  });

  it("قيم مجهولة أو بغير شكلها تعود إلى الافتراضي ولا ترمي", () => {
    const filter = parseOrdersQuery(
      { tab: "refunded", page: "-4", from: ["a", "b"], reference: ["x"] },
      TODAY,
    );
    expect(filter).toMatchObject({ tab: "all", page: 1, customRange: false, reference: null });
    expect(parseOrdersQuery({ page: "0" }, TODAY).page).toBe(1);
    expect(parseOrdersQuery({ page: "99999" }, TODAY).page).toBe(10_000);
    expect(parseOrdersQuery({ page: "1e3" }, TODAY).page).toBe(1);
    expect(parseOrdersQuery({ from: "x".repeat(5000) }, TODAY).customRange).toBe(false);
  });

  it("المرجع يُطبَّع، وغير الصالح يبقى نصه ليُشرح للموظف", () => {
    expect(parseOrdersQuery({ reference: " 1234 " }, TODAY).reference).toEqual({
      raw: "1234",
      normalized: "MSR-0001234",
    });
    expect(parseOrdersQuery({ reference: "msr-0000042" }, TODAY).reference?.normalized).toBe(
      "MSR-0000042",
    );
    expect(parseOrdersQuery({ reference: "أحمد" }, TODAY).reference).toEqual({
      raw: "أحمد",
      normalized: null,
    });
    expect(parseOrdersQuery({ reference: "" }, TODAY).reference).toBeNull();
    expect(parseOrdersQuery({ reference: "9".repeat(25) }, TODAY).reference).toBeNull();
  });
});

describe("ordersHref", () => {
  it("الافتراضي بلا استعلام، والمدى المكتوب يبقى مع التبويب والصفحة", () => {
    const plain = parseOrdersQuery({}, TODAY);
    expect(ordersHref(plain)).toBe("/admin/sales/orders");
    expect(ordersHref(plain, { tab: "paid" })).toBe("/admin/sales/orders?tab=paid");
    expect(ordersHref(plain, { page: 2 })).toBe("/admin/sales/orders?page=2");
    const ranged = parseOrdersQuery({ tab: "paid", from: "2026-06-01", page: "4" }, TODAY);
    expect(ordersHref(ranged, { page: 5 })).toBe(
      "/admin/sales/orders?tab=paid&from=2026-06-01&to=2026-06-15&page=5",
    );
  });

  it("تغيير التبويب يعيد إلى الصفحة الأولى", () => {
    const filter = parseOrdersQuery({ tab: "paid", page: "4" }, TODAY);
    expect(ordersHref(filter, { tab: "cancelled" })).toBe("/admin/sales/orders?tab=cancelled");
    expect(ordersHref(filter, { tab: "all" })).toBe("/admin/sales/orders");
  });

  it("المرجع لا يُحمل في روابط التبويب والصفحات", () => {
    const filter = parseOrdersQuery({ reference: "1234" }, TODAY);
    expect(ordersHref(filter, { tab: "paid" })).not.toContain("reference");
  });
});
