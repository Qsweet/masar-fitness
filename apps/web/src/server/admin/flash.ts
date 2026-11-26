import "server-only";
import { openSecret, sealSecret } from "@masar/db";
import { cookies } from "next/headers";
import { z } from "zod";
import { getEnv } from "../env";
import { adminCookie } from "./cookie";
import { adminSecretKey } from "./flag";

/**
 * سر يُعرض مرة: رموز الاسترجاع بعد التسجيل، أو كلمة المرور المؤقتة بعد إنشاء موظف أو إعادة ضبطه.
 * ينتقل من الإجراء إلى الصفحة التالية في كوكي HttpOnly مشفّر AES-256-GCM بمفتاح اللوحة ومربوط
 * بمعرّف الموظف المشاهد، وعمره دقائق، ويُمحى حين يؤكد الموظف أنه حفظه. لا يُحفظ في القاعدة إلا مجزأً.
 */
const FLASH_SUFFIX = "_flash";
const FLASH_MINUTES = 10;
const SECONDS_PER_MINUTE = 60;
const FLASH_MAX_AGE_SECONDS = FLASH_MINUTES * SECONDS_PER_MINUTE;

const flashSchema = z.object({
  kind: z.enum(["recovery_codes", "temporary_password"]),
  /** معرّف الموظف الذي يخصه السر (صاحب الكلمة المؤقتة، أو المشاهد نفسه لرموز الاسترجاع). */
  subject: z.string(),
  values: z.array(z.string()).min(1),
});

export type AdminFlash = z.infer<typeof flashSchema>;

function flashCookie() {
  const { name, options } = adminCookie(getEnv().SITE_URL);
  return { name: `${name}${FLASH_SUFFIX}`, options };
}

function contextOf(viewerId: string): string {
  return `flash:${viewerId}`;
}

export async function writeFlash(viewerId: string, flash: AdminFlash): Promise<void> {
  const { name, options } = flashCookie();
  const payload = new TextEncoder().encode(JSON.stringify(flash));
  const sealed = sealSecret(adminSecretKey(), payload, contextOf(viewerId));
  (await cookies()).set(name, sealed, { ...options, maxAge: FLASH_MAX_AGE_SECONDS });
}

/** السر المنتظر لهذا المشاهد، أو null (لا كوكي، أو لمشاهد آخر، أو معبوث به). */
export async function readFlash(viewerId: string): Promise<AdminFlash | null> {
  const sealed = (await cookies()).get(flashCookie().name)?.value;
  const opened =
    sealed === undefined ? null : openSecret(adminSecretKey(), sealed, contextOf(viewerId));
  if (opened === null) {
    return null;
  }
  try {
    const parsed = flashSchema.safeParse(JSON.parse(new TextDecoder().decode(opened)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearFlash(): Promise<void> {
  const { name, options } = flashCookie();
  (await cookies()).set(name, "", { ...options, maxAge: 0 });
}
