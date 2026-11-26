import "server-only";
import { headers } from "next/headers";
import { clientIp } from "../http/client-ip";

export interface RequestMeta {
  readonly ip: string;
  readonly userAgent: string;
}

/** عنوان الطلب (كما كتبه الوسيط، انظر `clientIp`) ومتصفحه، لسجل الجلسة والتدقيق. */
export async function requestMeta(): Promise<RequestMeta> {
  const list = await headers();
  return {
    ip: clientIp(list.get("x-forwarded-for")),
    userAgent: list.get("user-agent") ?? "",
  };
}
