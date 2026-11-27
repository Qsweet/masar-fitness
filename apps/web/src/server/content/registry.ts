import "server-only";
import { createHash } from "node:crypto";
import { buildTextRegistry, type TextRegistry } from "@masar/domain";
import { TEXT_RULES } from "@/content/site/editable";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

/** بصمة SHA-256 بالست عشري: للافتراضي في السجل، ولمحتوى الإصدار. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

let registry: TextRegistry | undefined;

/** سجل نصوص الموقع من القاموسين وقائمة السماح، يُبنى مرة في العملية. */
export function textRegistry(): TextRegistry {
  registry ??= buildTextRegistry({ ar, en }, TEXT_RULES, sha256Hex);
  return registry;
}
