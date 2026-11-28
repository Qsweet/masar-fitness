"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AdminDictionary } from "@/i18n/admin";

type KitText = AdminDictionary["kit"];

const KitContext = createContext<KitText | null>(null);

/** نصوص عدّة النماذج لمكوّنات العميل (شريط الحفظ وحارس المغادرة)، من قاموس الخادم مرة للهيكل كله. */
export function FormKitProvider({
  text,
  children,
}: {
  readonly text: KitText;
  readonly children: ReactNode;
}) {
  return <KitContext value={text}>{children}</KitContext>;
}

/** null خارج الهيكل (صفحات البوابة): الشريط يبقى تذييلًا عاديًا بلا نص حالة. */
export function useKitText(): KitText | null {
  return useContext(KitContext);
}
