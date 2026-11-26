/**
 * HMAC-SHA1 بلا منصة لاختبارات المجال فقط (المجال لا يستورد `node:crypto`). الإنتاج يحقن تنفيذ
 * Node، ومتجهات RFC نفسها تُعاد عليه في `packages/db/src/staff/crypto/crypto.test.ts`.
 */
import type { HmacSha1 } from "./totp";

const BLOCK_BYTES = 64;
const WORD_BYTES = 4;
const LENGTH_BYTES = 8;
const ROUNDS = 80;
const SCHEDULE_SEED_WORDS = 16;
const BYTE_BITS = 8;
const WORD_BITS = 32;
const PAD_BIT = 0x80;
const INNER_PAD = 0x36;
const OUTER_PAD = 0x5c;
// ثوابت FIPS 180-4 بأسمائها في المواصفة
const H0 = 0x67452301;
const H1 = 0xefcdab89;
const H2 = 0x98badcfe;
const H3 = 0x10325476;
const H4 = 0xc3d2e1f0;
const K0 = 0x5a827999;
const K1 = 0x6ed9eba1;
const K2 = 0x8f1bbcdc;
const K3 = 0xca62c1d6;
const INITIAL_STATE = [H0, H1, H2, H3, H4] as const;
const ROUND_CONSTANTS = [K0, K1, K2, K3] as const;
const ROUNDS_PER_STAGE = 20;
const ROTATE_A = 5;
const ROTATE_B = 30;
const TAP_3 = 3;
const TAP_8 = 8;
const TAP_14 = 14;
const TAP_16 = 16;

function rotl(value: number, bits: number): number {
  return ((value << bits) | (value >>> (WORD_BITS - bits))) >>> 0;
}

function pad(message: Uint8Array): Uint8Array {
  const withBit = message.length + 1 + LENGTH_BYTES;
  const padded = new Uint8Array(Math.ceil(withBit / BLOCK_BYTES) * BLOCK_BYTES);
  padded.set(message);
  padded[message.length] = PAD_BIT;
  // الطول بالبتات في آخر 4 بايتات يكفي لرسائل الاختبار القصيرة
  new DataView(padded.buffer).setUint32(padded.length - WORD_BYTES, message.length * BYTE_BITS);
  return padded;
}

function stageFunction(stage: number, b: number, c: number, d: number): number {
  if (stage === 0) {
    return (b & c) | (~b & d);
  }
  return stage === 2 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
}

function schedule(view: DataView, offset: number): number[] {
  const words: number[] = [];
  for (let index = 0; index < ROUNDS; index += 1) {
    if (index < SCHEDULE_SEED_WORDS) {
      words.push(view.getUint32(offset + index * WORD_BYTES));
    } else {
      const mixed =
        (words[index - TAP_3] ?? 0) ^
        (words[index - TAP_8] ?? 0) ^
        (words[index - TAP_14] ?? 0) ^
        (words[index - TAP_16] ?? 0);
      words.push(rotl(mixed, 1));
    }
  }
  return words;
}

function compress(state: number[], words: readonly number[]): number[] {
  let [a = 0, b = 0, c = 0, d = 0, e = 0] = state;
  words.forEach((word, index) => {
    const stage = Math.floor(index / ROUNDS_PER_STAGE);
    const mixed = stageFunction(stage, b, c, d) + e + (ROUND_CONSTANTS[stage] ?? 0) + word;
    const next = (rotl(a, ROTATE_A) + mixed) >>> 0;
    [a, b, c, d, e] = [next, a, rotl(b, ROTATE_B), c, d];
  });
  return [a, b, c, d, e].map((value, index) => (value + (state[index] ?? 0)) >>> 0);
}

function sha1(message: Uint8Array): Uint8Array {
  const padded = pad(message);
  const view = new DataView(padded.buffer);
  let state: number[] = [...INITIAL_STATE];
  for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
    state = compress(state, schedule(view, offset));
  }
  const digest = new Uint8Array(state.length * WORD_BYTES);
  state.forEach((word, index) => {
    new DataView(digest.buffer).setUint32(index * WORD_BYTES, word);
  });
  return digest;
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const joined = new Uint8Array(left.length + right.length);
  joined.set(left);
  joined.set(right, left.length);
  return joined;
}

export const testHmacSha1: HmacSha1 = (key, message) => {
  const block = new Uint8Array(BLOCK_BYTES);
  block.set(key.length > BLOCK_BYTES ? sha1(key) : key);
  const inner = block.map((byte) => byte ^ INNER_PAD);
  const outer = block.map((byte) => byte ^ OUTER_PAD);
  return sha1(concat(outer, sha1(concat(inner, message))));
};

/** نص ASCII إلى بايتات (لا TextEncoder في مكتبة المجال). */
export function asciiBytes(text: string): Uint8Array {
  return Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0)));
}
