import { err, ok, type Result } from "@masar/domain";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * `TRACKING_TRANSPORT` للأمر كما يفحصه إقلاع الموقع (`parse-env`): `live` أو `fake`، و`fake` على
 * عنوان الجهاز وحده، فلا يُطفأ الإرسال على خادم حقيقي بخطأ في البيئة.
 */
export function transportChoice(value: string, siteUrl: string): Result<"live" | "fake", string> {
  if (value !== "live" && value !== "fake") {
    return err("TRACKING_TRANSPORT must be live or fake.");
  }
  if (value === "fake" && !isLoopback(siteUrl)) {
    return err("TRACKING_TRANSPORT=fake sends nothing and needs a loopback SITE_URL.");
  }
  return ok(value);
}

function isLoopback(siteUrl: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(siteUrl).hostname);
  } catch {
    return false;
  }
}
