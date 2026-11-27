import { createHash } from "node:crypto";

/** SHA-256 ست عشري بحروف صغيرة، كما تطلبه المنصات الأربع (ADMIN_A5_TRACKING §4.4). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
