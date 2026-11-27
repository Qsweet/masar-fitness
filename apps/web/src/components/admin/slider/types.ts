import type { SlideImage } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";

/** ما تحتاجه نماذج الشريط في المتصفح: صور المكتبة للمنتقي، ووجهات الروابط بأسمائها. */
export interface AssetOption extends SlideImage {
  readonly name: string;
}

export const TARGET_GROUPS = ["pages", "anchors", "plans", "articles"] as const;
export type TargetGroup = (typeof TARGET_GROUPS)[number];

export interface TargetOption {
  readonly path: string;
  readonly label: string;
  readonly group: TargetGroup;
}

export type SliderText = AdminDictionary["slider"];
