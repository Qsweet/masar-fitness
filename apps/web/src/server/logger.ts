import "server-only";

type LogLevel = "info" | "warn" | "error";
type LogFields = Readonly<Record<string, unknown>>;

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack, cause: error.cause };
  }
  return error;
}

function write(level: LogLevel, event: string, fields: LogFields): void {
  const entry = { level, event, time: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry, (_key, value: unknown) =>
    value instanceof Error ? serializeError(value) : value,
  );
  // سطر JSON واحد لكل حدث: يقرؤه أي جامع سجلات بلا تحليل نصي
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

/**
 * سجل منظَّم. `event` اسم ثابت (مثل "health.db_unreachable") والتفاصيل في الحقول.
 * ممنوع تسجيل أسرار أو بيانات بطاقات أو أرقام جوالات كاملة.
 */
export const logger = {
  info: (event: string, fields: LogFields = {}) => {
    write("info", event, fields);
  },
  warn: (event: string, fields: LogFields = {}) => {
    write("warn", event, fields);
  },
  error: (event: string, fields: LogFields = {}) => {
    write("error", event, fields);
  },
};
