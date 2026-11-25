import "server-only";
import type { Metadata } from "next";

/** صفحات الشراء خاصة بكل زائر: لا فهرسة ولا تتبّع روابط، ولا رابط معتمد أو بدائل لغوية. */
export function checkoutMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
