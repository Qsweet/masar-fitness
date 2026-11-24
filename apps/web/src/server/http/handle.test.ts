import { DomainError } from "@masar/domain";
import { notFound, redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withErrorHandling } from "./handle";

const request = new Request("https://example.com/api/orders?token=abc", { method: "POST" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withErrorHandling", () => {
  it("يمرر الرد الناجح كما هو", async () => {
    const handler = withErrorHandling(() => Promise.resolve(Response.json({ ok: true })));
    expect(await (await handler(request, undefined)).json()).toEqual({ ok: true });
  });

  it("خطأ العمل يرجع حالته ومفتاح سببه ولا يُسجَّل كعطل", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = withErrorHandling(() =>
      Promise.reject(new DomainError("validation", "mobile.not_saudi_mobile", { field: "mobile" })),
    );
    const response = await handler(request, undefined);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "mobile.not_saudi_mobile",
      field: "mobile",
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("العطل غير المتوقع: رد عام بلا تفاصيل، وسجل كامل بنفس requestId وبلا نص الاستعلام", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = withErrorHandling(() =>
      Promise.reject(new Error("connect failed password=hunter2 host=10.0.0.5")),
    );
    const response = await handler(request, undefined);
    const body = (await response.json()) as { requestId: string; code: string };
    const raw = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body.code).toBe("internal_error");
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("10.0.0.5");

    expect(errorLog).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(errorLog.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      event: "http.unhandled_error",
      requestId: body.requestId,
      method: "POST",
      path: "/api/orders",
    });
    // المسار فقط: نص الاستعلام قد يحمل رموزًا
    expect(JSON.stringify(logged.path)).not.toContain("token");
  });

  it("أخطاء التحكم الخاصة بـNext تمر ولا تتحول إلى 500", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      withErrorHandling(() => Promise.resolve(redirect("/elsewhere")))(request, undefined),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(
      withErrorHandling(() => Promise.resolve(notFound()))(request, undefined),
    ).rejects.toThrow();
    expect(errorLog).not.toHaveBeenCalled();
  });
});
