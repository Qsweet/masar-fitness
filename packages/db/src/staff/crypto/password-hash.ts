/**
 * تجزئة كلمات مرور الموظفين بـscrypt من `node:crypto` (ADMIN_DESIGN §4.3): N=2^17, r=8, p=1، ملح 16
 * بايت، ناتج 32 بايت. الصيغة النصية تحمل المعاملات (`scrypt$N=…,r=…,p=…$salt$hash`) لتُرفع لاحقًا
 * دون إبطال القديم: التحقق يقرأ معاملات كل تجزئة، و`needsRehash` يكشف ما دون الحالي.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const SCHEME = "scrypt";
const COST_LOG2 = 17;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
/** scrypt يحتاج ‎128·N·r‎ بايت؛ الحد الافتراضي في Node (32MB) أقل مما تطلبه N=2^17. */
const MEMORY_FACTOR = 128;
const MEMORY_HEADROOM = 2;
/** أعلى كلفة تُقبل من تجزئة مخزَّنة، حتى لا يستنزف صف فاسد ذاكرة الخادم. */
const MAX_COST_LOG2 = 20;

export interface ScryptParams {
  readonly cost: number;
  readonly blockSize: number;
  readonly parallelization: number;
}

export const CURRENT_SCRYPT_PARAMS: ScryptParams = {
  cost: 2 ** COST_LOG2,
  blockSize: BLOCK_SIZE,
  parallelization: PARALLELIZATION,
};

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.cost,
    r: params.blockSize,
    p: params.parallelization,
    maxmem: MEMORY_FACTOR * params.cost * params.blockSize * MEMORY_HEADROOM,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, options, (error, key) => {
      if (error === null) {
        resolve(key);
      } else {
        reject(error);
      }
    });
  });
}

function encode(params: ScryptParams, salt: Buffer, key: Buffer): string {
  const header = `N=${String(params.cost)},r=${String(params.blockSize)},p=${String(params.parallelization)}`;
  return [SCHEME, header, salt.toString("base64"), key.toString("base64")].join("$");
}

/** يجزّئ كلمة مرور (موحّدة NFKC من المجال) بالمعاملات الحالية. `params` للاختبارات السريعة فقط. */
export async function hashPassword(
  password: string,
  params: ScryptParams = CURRENT_SCRYPT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  return encode(params, salt, await derive(password, salt, params));
}

interface ParsedHash {
  readonly params: ScryptParams;
  readonly salt: Buffer;
  readonly key: Buffer;
}

const HASH_SHAPE =
  /^scrypt\$N=(?<cost>[0-9]+),r=(?<blockSize>[0-9]+),p=(?<parallelization>[0-9]+)\$(?<salt>[A-Za-z0-9+/=]+)\$(?<key>[A-Za-z0-9+/=]+)$/;

function isAcceptable(params: ScryptParams): boolean {
  const { cost, blockSize, parallelization } = params;
  const powerOfTwo = Number.isInteger(Math.log2(cost)) && cost > 1;
  return (
    powerOfTwo &&
    cost <= 2 ** MAX_COST_LOG2 &&
    blockSize === BLOCK_SIZE &&
    parallelization === PARALLELIZATION
  );
}

function parseHash(stored: string): ParsedHash | null {
  const groups = HASH_SHAPE.exec(stored)?.groups;
  if (groups === undefined) {
    return null;
  }
  const params: ScryptParams = {
    cost: Number(groups.cost),
    blockSize: Number(groups.blockSize),
    parallelization: Number(groups.parallelization),
  };
  const salt = Buffer.from(groups.salt ?? "", "base64");
  const key = Buffer.from(groups.key ?? "", "base64");
  const sized = salt.length === SALT_BYTES && key.length === KEY_BYTES;
  return sized && isAcceptable(params) ? { params, salt, key } : null;
}

/** مقارنة بزمن ثابت. تجزئة مخزَّنة فاسدة الشكل = عدم تطابق، لا استثناء. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (parsed === null) {
    return false;
  }
  const key = await derive(password, parsed.salt, parsed.params);
  return timingSafeEqual(key, parsed.key);
}

/** هل التجزئة بمعاملات أضعف من الحالية (تُعاد عند أول دخول ناجح)؟ */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  return parsed === null || parsed.params.cost < CURRENT_SCRYPT_PARAMS.cost;
}

let dummyHash: Promise<string> | undefined;

/**
 * يستهلك زمن تحقق حقيقي حين لا يوجد الحساب، فلا يكشف زمن الرد وجود البريد. التجزئة الوهمية
 * تُحسب مرة لكلمة عشوائية لا يعرفها أحد، والنتيجة دائمًا false.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(KEY_BYTES).toString("base64"));
  await verifyPassword(password, await dummyHash);
  return false;
}
