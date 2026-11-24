import "server-only";
import { buildLogLine, type LogFields, type LogLevel } from "./log-entry";

function write(level: LogLevel, event: string, fields: LogFields): void {
  const line = buildLogLine(level, event, fields, new Date());
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
