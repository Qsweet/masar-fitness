import { describe, expect, it } from "vitest";
import { buildLogLine } from "./log-entry";

const NOW = new Date("2026-11-24T10:00:00.000Z");

function parse(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

describe("buildLogLine", () => {
  it("سطر JSON بالحقول الثابتة", () => {
    expect(parse(buildLogLine("info", "order.created", { orderId: "o1" }, NOW))).toEqual({
      orderId: "o1",
      level: "info",
      event: "order.created",
      time: "2026-11-24T10:00:00.000Z",
    });
  });

  it("حقل من المستدعي لا يطمس level أو event أو time", () => {
    const entry = parse(
      buildLogLine("error", "real.event", { level: "info", event: "fake", time: "x" }, NOW),
    );
    expect(entry.level).toBe("error");
    expect(entry.event).toBe("real.event");
    expect(entry.time).toBe("2026-11-24T10:00:00.000Z");
  });

  it("يسجّل الخطأ العادي بسببه", () => {
    const error = new Error("outer", { cause: new Error("inner") });
    const entry = parse(buildLogLine("error", "e", { error }, NOW));
    expect(entry.error).toMatchObject({
      name: "Error",
      message: "outer",
      cause: { message: "inner" },
    });
  });

  it("لا يسجّل من أخطاء Prisma إلا النوع والرمز (رسالتها تحمل قيم الاستعلام)", () => {
    const error = Object.assign(new Error("Invalid `db.customer.create()` phone: +966512345678"), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    const line = buildLogLine("error", "e", { error }, NOW);
    expect(line).not.toContain("966512345678");
    expect(parse(line).error).toEqual({ name: "PrismaClientKnownRequestError", code: "P2002" });
  });

  it("خطأ Prisma داخل cause يُحجب أيضًا", () => {
    const orm = Object.assign(new Error("secret +966512345678"), {
      name: "PrismaClientValidationError",
    });
    const line = buildLogLine("error", "e", { error: new Error("wrapper", { cause: orm }) }, NOW);
    expect(line).not.toContain("966512345678");
  });

  it("لا يرمي عند مرجع دائري ولا يضيع الحدث", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(parse(buildLogLine("error", "e.circular", { circular }, NOW))).toEqual({
      level: "error",
      event: "e.circular",
      time: "2026-11-24T10:00:00.000Z",
      logError: "fields_not_serializable",
    });
  });

  it("يحوّل BigInt بدل أن يرمي", () => {
    expect(parse(buildLogLine("info", "e", { amount: 10n }, NOW)).amount).toBe("10");
  });

  it("سلسلة cause دائرية لا تعلّق", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    a.cause = b;
    expect(() => buildLogLine("error", "e", { error: a }, NOW)).not.toThrow();
  });
});
