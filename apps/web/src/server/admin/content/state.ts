import "server-only";
import {
  findRelease,
  latestRelease,
  listDraftEntries,
  loadDraftSlider,
  type DraftRow,
  type DraftSlider,
  type ReleaseHead,
} from "@masar/db";
import {
  draftOverrides,
  draftSettings,
  EMPTY_SLIDER,
  NO_SETTINGS,
  parseSnapshot,
  snapshotSettings,
  snapshotSlider,
  type ParsedSettings,
  type ParsedSnapshot,
  type SettingOverrides,
  type SliderState,
  type TextOverrides,
  type TextRegistry,
} from "@masar/domain";
import { getDb } from "../../db";

/**
 * حالة محتوى النادي للوحة: صفوف المسودة (برموز قفلها)، وتجاوزاتها الفعلية والمعطّل منها، وآخر إصدار
 * وتجاوزاته، والشريط في المسودة وفي المنشور (ADMIN_A3_SLIDER §7). اللوحة تقرأ نادي الموظف؛ الموقع
 * العام يقرأ نادي المحتوى (`siteClubId`).
 */
export interface PublishedState {
  readonly head: ReleaseHead | null;
  readonly texts: TextOverrides;
  readonly slider: SliderState;
  readonly settings: SettingOverrides;
}

export interface ContentState {
  readonly rows: readonly DraftRow[];
  readonly draft: ParsedSnapshot;
  /** إعدادات المسودة المنظَّمة (§5) والمعطّل منها. */
  readonly settings: ParsedSettings;
  readonly slider: DraftSlider;
  readonly published: PublishedState;
}

export async function loadPublished(
  clubId: string,
  registry: TextRegistry,
): Promise<PublishedState> {
  const head = await latestRelease(getDb(), clubId);
  if (head === null) {
    return { head, texts: new Map(), slider: EMPTY_SLIDER, settings: NO_SETTINGS };
  }
  const release = await findRelease(getDb(), clubId, head.id);
  return {
    head,
    texts: parseSnapshot(release?.snapshot, registry)?.texts ?? new Map(),
    slider: snapshotSlider(release?.snapshot).slider,
    settings: snapshotSettings(release?.snapshot).settings,
  };
}

export async function loadContentState(
  clubId: string,
  registry: TextRegistry,
): Promise<ContentState> {
  const [rows, slider, published] = await Promise.all([
    listDraftEntries(getDb(), clubId),
    loadDraftSlider(getDb(), clubId),
    loadPublished(clubId, registry),
  ]);
  return {
    rows,
    draft: draftOverrides(rows, registry),
    settings: draftSettings(rows),
    slider,
    published,
  };
}
