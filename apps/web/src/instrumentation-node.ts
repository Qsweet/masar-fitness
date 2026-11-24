import { InvalidEnvError, parseEnv } from "./server/env/parse-env";

const EXIT_INVALID_CONFIG = 1;

/**
 * إعداد خاطئ أو ناقص ينهي العملية فورًا برمز خطأ، ليراه مدير العمليات ويفشل النشر،
 * بدل خادم حي لا يخدم أو عطل يظهر عند أول عميل.
 */
export function assertEnvAtBoot(): void {
  try {
    parseEnv(process.env);
  } catch (error) {
    if (!(error instanceof InvalidEnvError)) {
      throw error;
    }
    process.stderr.write(`${error.message}\n`);
    process.exit(EXIT_INVALID_CONFIG);
  }
}
