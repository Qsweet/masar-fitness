import { openSecret, sealSecret } from "@masar/db";
import { z } from "zod";
import { CONTENT_PUBLISH_TOKEN_MINUTES } from "@/config/admin";

/**
 * رمز النشر (ADMIN_A3_CONTENT §8.4، نمط `settle-token.ts`): ما راجعه الناشر (بصمة المسودة ومعرّف آخر
 * إصدار) مختومًا بمفتاح اللوحة ومربوطًا بالموظف، عشر دقائق. النشر يقارن به ما يجده تحت القفل.
 */
const MINUTE_MS = 60_000;
const MAX_AGE_MS = CONTENT_PUBLISH_TOKEN_MINUTES * MINUTE_MS;
export const MAX_PUBLISH_TOKEN_LENGTH = 1_000;

const payloadSchema = z.object({
  digest: z.string().regex(/^[0-9a-f]{64}$/),
  latestId: z.uuid().nullable(),
  issuedAt: z.number().int(),
});

export interface PublishTokenPayload {
  readonly digest: string;
  readonly latestId: string | null;
}

function contextOf(staffId: string): string {
  return `content-publish:${staffId}`;
}

export function sealPublishToken(
  key: Uint8Array,
  staffId: string,
  payload: PublishTokenPayload,
  now: Date,
): string {
  const sealed: z.infer<typeof payloadSchema> = { ...payload, issuedAt: now.getTime() };
  return sealSecret(key, new TextEncoder().encode(JSON.stringify(sealed)), contextOf(staffId));
}

/** ما في الرمز، أو null (معبوث به، أو لموظف آخر، أو مضت مهلته، أو بغير شكله). */
export function openPublishToken(
  key: Uint8Array,
  staffId: string,
  token: string,
  now: Date,
): PublishTokenPayload | null {
  if (token === "" || token.length > MAX_PUBLISH_TOKEN_LENGTH) {
    return null;
  }
  const opened = openSecret(key, token, contextOf(staffId));
  if (opened === null) {
    return null;
  }
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(new TextDecoder().decode(opened)));
    const age = parsed.success ? now.getTime() - parsed.data.issuedAt : -1;
    if (!parsed.success || age < 0 || age >= MAX_AGE_MS) {
      return null;
    }
    return { digest: parsed.data.digest, latestId: parsed.data.latestId };
  } catch {
    return null;
  }
}
