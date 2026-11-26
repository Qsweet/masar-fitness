import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * قائمة قبول ADMIN_A2_SALES §13 (1): لا كتابة `orders.status = 'paid'` خارج `mark-order-paid.ts`.
 * فحص نصي على كود الإنتاج في الحزم الثلاث: مسار تسوية ثانٍ يفشل هنا قبل أن يصل إلى مراجعة.
 */
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SOURCES = ["packages/db/src", "packages/payments/src", "apps/web/src"];
const SINGLE_PATH = "packages/db/src/commerce/mark-order-paid.ts";
const SKIPPED = /(?:\.test\.tsx?|[\\/](?:generated|test-support)[\\/])/;
/** كتابة الحالة مدفوعةً بـSQL (`status = 'paid'`) أو بعميل Prisma (`status: "paid"` داخل data). */
const PAID_WRITES = [/SET[^;`]*\bstatus\s*=\s*'paid'/is, /data:\s*\{[^}]*status:\s*["']paid["']/s];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function productionFiles(): string[] {
  return SOURCES.flatMap((source) => filesUnder(join(ROOT, source)))
    .filter((path) => /\.tsx?$/.test(path) && !SKIPPED.test(path))
    .map((path) => relative(ROOT, path).replaceAll("\\", "/"));
}

describe("مسار التسوية الوحيد", () => {
  it("الطلب لا يُكتب مدفوعًا إلا في mark-order-paid.ts", () => {
    const files = productionFiles();
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(SINGLE_PATH);
    const writers = files.filter((file) => {
      const text = readFileSync(join(ROOT, file), "utf8");
      return PAID_WRITES.some((pattern) => pattern.test(text));
    });
    expect(writers).toEqual([SINGLE_PATH]);
  });

  it("الدفع اليدوي يستدعي settleInTransaction ولا يكتب الحالة بنفسه", () => {
    const manual = readFileSync(
      join(ROOT, "packages/db/src/orders-admin/manual-payment.ts"),
      "utf8",
    );
    expect(manual).toContain("settleInTransaction(tx,");
    expect(manual).not.toMatch(/UPDATE\s+orders/i);
  });
});
