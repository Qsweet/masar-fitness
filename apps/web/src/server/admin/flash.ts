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
const MS_PER_SECOND = 1000;
const FLASH_MAX_AGE_MS = FLASH_MAX_AGE_SECONDS * MS_PER_SECOND;

const flashSchema = z.object({
  kind: z.enum(["recovery_codes", "temporary_password"]),
  /** معرّف الموظف الذي يخصه السر (صاحب الكلمة المؤقتة، أو المشاهد نفسه لرموز الاسترجاع). */
  subject: z.string(),
  values: z.array(z.string()).min(1),
});

/** ما يُشفَّر في الكوكي: السر ووقت إصداره. عمر الكوكي في المتصفح لا يُؤتمن؛ الخادم يفحص الوقت. */
const sealedSchema = flashSchema.extend({ issuedAt: z.number().int() });

export type AdminFlash = z.infer<typeof flashSchema>;

/** هل ما زال السر ضمن مهلة العرض؟ وقت من المستقبل مرفوض أيضًا. */
function isFresh(issuedAt: number, nowMs: number): boolean {
  return issuedAt <= nowMs && nowMs - issuedAt < FLASH_MAX_AGE_MS;
}

function flashCookie() {
  const { name, options } = adminCookie(getEnv().SITE_URL);
  return { name: `${name}${FLASH_SUFFIX}`, options };
}

function contextOf(viewerId: string): string {
  return `flash:${viewerId}`;
}

export async function writeFlash(
  viewerId: string,
  flash: AdminFlash,
  now: Date = new Date(),
): Promise<void> {
  const { name, options } = flashCookie();
  const sealedFlash = { ...flash, issuedAt: now.getTime() };
  const payload = new TextEncoder().encode(JSON.stringify(sealedFlash));
  const sealed = sealSecret(adminSecretKey(), payload, contextOf(viewerId));
  (await cookies()).set(name, sealed, { ...options, maxAge: FLASH_MAX_AGE_SECONDS });
}

/** السر المنتظر لهذا المشاهد، أو null (لا كوكي، أو لمشاهد آخر، أو معبوث به، أو مضت مهلته). */
export async function readFlash(
  viewerId: string,
  now: Date = new Date(),
): Promise<AdminFlash | null> {
  const sealed = (await cookies()).get(flashCookie().name)?.value;
  const opened =
    sealed === undefined ? null : openSecret(adminSecretKey(), sealed, contextOf(viewerId));
  if (opened === null) {
    return null;
  }
  try {
    const parsed = sealedSchema.safeParse(JSON.parse(new TextDecoder().decode(opened)));
    if (!parsed.success || !isFresh(parsed.data.issuedAt, now.getTime())) {
      return null;
    }
    // المخطط يسقط وقت الإصدار: ما يخرج هو السر وحده
    return flashSchema.parse(parsed.data);
  } catch {
    return null;
  }
}

export async function clearFlash(): Promise<void> {
  const { name, options } = flashCookie();
  (await cookies()).set(name, "", { ...options, maxAge: 0 });
}
