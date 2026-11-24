export type LogLevel = "info" | "warn" | "error";
export type LogFields = Readonly<Record<string, unknown>>;

const MAX_CAUSE_DEPTH = 3;

/**
 * أخطاء Prisma تضع قيم الاستعلام (قد تكون جوال عميل) داخل `message` و`stack`،
 * فلا نسجّل منها إلا النوع والرمز.
 */
function isOrmError(error: Error): boolean {
  return error.name.startsWith("Prisma");
}

function serializeError(error: Error, depth: number): Record<string, unknown> {
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  if (isOrmError(error)) {
    return { name: error.name, code };
  }
  const cause =
    error.cause instanceof Error && depth < MAX_CAUSE_DEPTH
      ? serializeError(error.cause, depth + 1)
      : undefined;
  return { name: error.name, message: error.message, code, stack: error.stack, cause };
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value, 0);
  }
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * سطر JSON واحد لكل حدث. لا يرمي أبدًا: فشل التحويل (مرجع دائري مثلًا) يُنتج سطرًا بديلًا
 * حتى لا يضيع الحدث ولا ينكسر معالج الخطأ الذي استدعى السجل.
 */
export function buildLogLine(level: LogLevel, event: string, fields: LogFields, now: Date): string {
  const time = now.toISOString();
  try {
    // الحقول الثابتة آخرًا: حقل من المستدعي باسم level أو event لا يطمسها
    return JSON.stringify({ ...fields, level, event, time }, replacer);
  } catch {
    return JSON.stringify({ level, event, time, logError: "fields_not_serializable" });
  }
}
