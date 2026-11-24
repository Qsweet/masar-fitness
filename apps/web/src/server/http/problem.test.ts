import { DomainError } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { isServerFault, problemFromError, problemResponse } from "./problem";

const REQUEST_ID = "req-1";

describe("problemFromError", () => {
  it.each([
    ["validation", 422],
    ["not_found", 404],
    ["conflict", 409],
    ["unauthenticated", 401],
    ["forbidden", 403],
  ] as const)("خطأ العمل %s ⇒ HTTP %i مع مفتاح السبب", (code, status) => {
    const problem = problemFromError(new DomainError(code, "some.reason"), REQUEST_ID);
    expect(problem).toEqual({
      type: "urn:masar:problem:some.reason",
      title: expect.any(String) as string,
      status,
      code: "some.reason",
      requestId: REQUEST_ID,
    });
    expect(isServerFault(problem)).toBe(false);
  });

  it("يذكر الحقل المسبِّب إن وُجد", () => {
    const error = new DomainError("validation", "mobile.not_saudi_mobile", { field: "mobile" });
    expect(problemFromError(error, REQUEST_ID).field).toBe("mobile");
  });

  it("خرق الثوابت يُعامل كعطل داخلي ولا يكشف سببه", () => {
    const problem = problemFromError(new DomainError("invariant", "money.overflow"), REQUEST_ID);
    expect(problem.status).toBe(500);
    expect(problem.code).toBe("internal_error");
    expect(JSON.stringify(problem)).not.toContain("money.overflow");
    expect(isServerFault(problem)).toBe(true);
  });

  it.each([[new Error("password=abc at 10.0.0.5")], ["نص"], [null], [undefined]])(
    "أي خطأ غير متوقع ⇒ 500 عام بلا تفاصيل",
    (error) => {
      const problem = problemFromError(error, REQUEST_ID);
      expect(problem).toEqual({
        type: "urn:masar:problem:internal_error",
        title: "Internal Server Error",
        status: 500,
        code: "internal_error",
        requestId: REQUEST_ID,
      });
    },
  );
});

describe("problemResponse", () => {
  it("يرجع problem+json غير قابل للتخزين", async () => {
    const problem = problemFromError(new DomainError("not_found", "plan.not_found"), REQUEST_ID);
    const response = problemResponse(problem);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(problem);
  });
});
