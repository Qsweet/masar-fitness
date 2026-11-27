import "server-only";
import { listMediaImages, loadDraftSlider, type DraftSlider } from "@masar/db";
import { MEDIA_PICKER_LIMIT } from "@/config/media-library";
import type { SlideLink, SliderState } from "@masar/domain";
import type { AssetOption, TargetOption } from "@/components/admin/slider/types";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { getDb } from "../../db";
import { slideLinkTargets, type LinkTarget } from "../../content/slider-links";
import { loadPublished } from "../content/state";
import { textRegistry } from "../../content/registry";

/**
 * ما تعرضه صفحات الشريط في اللوحة (docs/ADMIN_A3_SLIDER.md §11): المسودة بحالة كل شريحة الآن،
 * والمنشور للمقارنة، وصور المكتبة للمنتقي، ووجهات الروابط بأسمائها العربية.
 */
type Text = AdminDictionary["slider"];

export interface SliderAdmin {
  readonly draft: DraftSlider;
  readonly published: SliderState;
}

export async function loadSliderAdmin(clubId: string): Promise<SliderAdmin> {
  const [draft, published] = await Promise.all([
    loadDraftSlider(getDb(), clubId),
    loadPublished(clubId, textRegistry()),
  ]);
  return { draft, published: published.slider };
}

function targetOption(target: LinkTarget, text: Text): TargetOption {
  switch (target.kind) {
    case "page":
      return { path: target.path, group: "pages", label: text.linkTargets.pages[target.page] };
    case "anchor":
      return {
        path: target.path,
        group: "anchors",
        label: text.linkTargets.anchors[target.anchor],
      };
    case "plan":
      return { path: target.path, group: "plans", label: fill(text.linkTargets.plan, target) };
    case "article":
      return {
        path: target.path,
        group: "articles",
        label: fill(text.linkTargets.article, target),
      };
  }
}

export async function targetOptions(text: Text): Promise<TargetOption[]> {
  return (await slideLinkTargets()).map((target) => targetOption(target, text));
}

/** وصف الرابط في القائمة: اسم الصفحة، أو الرابط الخارجي، أو «بلا رابط». */
export function linkLabel(link: SlideLink, targets: readonly TargetOption[], text: Text): string {
  switch (link.kind) {
    case "none":
      return text.list.noLink;
    case "internal":
      return targets.find((target) => target.path === link.path)?.label ?? link.path;
    case "external":
      return link.url;
  }
}

export async function assetOptions(clubId: string): Promise<AssetOption[]> {
  return (await listMediaImages(getDb(), clubId, MEDIA_PICKER_LIMIT)).map((asset) => ({
    id: asset.id,
    hash: asset.hash,
    width: asset.width,
    height: asset.height,
    widths: asset.widths,
    blur: asset.blur,
    color: asset.color,
    name: asset.originalName,
  }));
}
