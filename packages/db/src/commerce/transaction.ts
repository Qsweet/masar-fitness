import { err, type DomainError, type Result } from "@masar/domain";
import type { Db } from "../client";
import { Prisma } from "../generated/prisma/client";

/** عميل معاملة تفاعلية. القراءات تقبله وتقبل `Db` نفسه لأن الثاني يحقق نوعه. */
export type Tx = Prisma.TransactionClient;

/** أقصى انتظار لاتصال من المجمَّع قبل بدء المعاملة (مللي ثانية). */
const TX_MAX_WAIT_MS = 5_000;
/** أقصى عمر للمعاملة كلها، ومنه انتظار الأقفال (مللي ثانية). */
const TX_TIMEOUT_MS = 10_000;

/**
 * READ COMMITTED: كل جملة بعد انتظار القفل تأخذ لقطة جديدة فترى ما اعتُمد قبلها،
 * فالأقفال الصريحة تكفي بلا SERIALIZABLE ولا حلقات إعادة محاولة.
 */
export const COMMERCE_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: TX_MAX_WAIT_MS,
  timeout: TX_TIMEOUT_MS,
} as const;

/** خطأ عمل يُرمى داخل المعاملة لتتراجع كلها، ثم يُحوَّل إلى Result خارجها. */
export class AbortWith extends Error {
  readonly error: DomainError;

  constructor(error: DomainError) {
    super(error.message, { cause: error });
    this.name = "AbortWith";
    this.error = error;
  }
}

/** يرفض العملية ويتراجع عن كل ما كُتب في المعاملة. */
export function abort(error: DomainError): never {
  throw new AbortWith(error);
}

/** المعاملات التي فتحها هذا الملف وما زالت تعمل: يُعرف بها هل العميل الممرَّر داخل معاملة. */
const OPEN_TRANSACTIONS = new WeakSet<object>();

function isRootClient(client: Db | Tx): client is Db {
  return !OPEN_TRANSACTIONS.has(client);
}

async function runTracked<T>(db: Db, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    OPEN_TRANSACTIONS.add(tx);
    try {
      return await work(tx);
    } finally {
      OPEN_TRANSACTIONS.delete(tx);
    }
  }, COMMERCE_TX_OPTIONS);
}

/**
 * يشغّل عملًا في معاملة واحدة. النتيجة `err` المرجَعة تُعتمد مع ما كُتب قبلها (سطر تدقيق الرفض مثلًا)،
 * أما `abort` فيتراجع عن كل شيء. الأعطال الأخرى تُرمى كما هي.
 */
export async function inTransaction<T>(
  db: Db,
  work: (tx: Tx) => Promise<Result<T, DomainError>>,
): Promise<Result<T, DomainError>> {
  try {
    return await runTracked(db, work);
  } catch (error) {
    if (error instanceof AbortWith) {
      return err(error.error);
    }
    throw error;
  }
}

/**
 * يضمن أن العمل يجري داخل معاملة: إن كان العميل معاملة مفتوحة من هنا استُعمل كما هو، وإلا فُتحت
 * له معاملة. لعمل من أكثر من جملة يعتمد على بقاء أقفاله بين الجمل، ويُستدعى من داخل معاملة ومن خارجها.
 */
export function ensureTransaction<T>(client: Db | Tx, work: (tx: Tx) => Promise<T>): Promise<T> {
  return isRootClient(client) ? runTracked(client, work) : work(client);
}
