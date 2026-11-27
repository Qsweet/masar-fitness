import { openSecret, sealSecret } from "@masar/db";
import { z } from "zod";
import {
  PREVIEW_COOKIE_LOCAL,
  PREVIEW_COOKIE_SECURE,
  PREVIEW_DRAFT,
  PREVIEW_MAX_AGE_SECONDS,
} from "@/config/admin";

/**
 * قيمة كوكي المعاينة (ADMIN_A3_CONTENT §8.3): `{staffId, target, exp}` مختومة AES-256-GCM بمفتاح اللوحة
 * في سياق خاص بها، فلا يُفتح بها رمز آخر ولا تُفتح هي في سياق آخر. صلاحيتها وحدها لا تكفي: المُحلِّل
 * يشترط جلسة الموظف نفسه بصلاحية `content.read`.
 */
const CONTEXT = "content-preview";
const SECOND_MS = 1_000;
/** أطول من قيمة مختومة صحيحة بكثير؛ الأطول مصنوع فلا يُفك. */
const MAX_COOKIE_LENGTH = 600;

const payloadSchema = z.object({
  staffId: z.uuid(),
  target: z.union([z.literal(PREVIEW_DRAFT), z.uuid()]),
  exp: z.number().int(),
});

export type PreviewPayload = Omit<z.infer<typeof payloadSchema>, "exp">;

/** اسم الكوكي: ‎__Host-‎ على https، وبلا بادئة على عنوان الجهاز بـhttp (كوكي الجلسة نفسه). */
export function previewCookieName(siteUrl: string): string {
  return new URL(siteUrl).protocol === "https:" ? PREVIEW_COOKIE_SECURE : PREVIEW_COOKIE_LOCAL;
}

export function sealPreview(key: Uint8Array, payload: PreviewPayload, now: Date): string {
  const exp = now.getTime() + PREVIEW_MAX_AGE_SECONDS * SECOND_MS;
  return sealSecret(key, new TextEncoder().encode(JSON.stringify({ ...payload, exp })), CONTEXT);
}

/** ما في الكوكي، أو null: معبوث به، أو مختوم لسياق آخر، أو منتهٍ، أو بغير شكله. */
export function openPreview(key: Uint8Array, value: string, now: Date): PreviewPayload | null {
  if (value === "" || value.length > MAX_COOKIE_LENGTH) {
    return null;
  }
  const opened = openSecret(key, value, CONTEXT);
  if (opened === null) {
    return null;
  }
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(new TextDecoder().decode(opened)));
    if (!parsed.success || parsed.data.exp <= now.getTime()) {
      return null;
    }
    return { staffId: parsed.data.staffId, target: parsed.data.target };
  } catch {
    return null;
  }
}
