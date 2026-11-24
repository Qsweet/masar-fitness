import "server-only";
import { parseEnv, type ServerEnv } from "./parse-env";

let cached: ServerEnv | undefined;

/** إعداد الخادم المتحقَّق منه. يُقرأ عند أول طلب لا عند البناء، فالبناء لا يحتاج أسرارًا. */
export function getEnv(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}
