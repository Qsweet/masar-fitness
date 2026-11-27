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
  EMPTY_SLIDER,
  parseSnapshot,
  snapshotSlider,
  type ParsedSnapshot,
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
}

export interface ContentState {
  readonly rows: readonly DraftRow[];
  readonly draft: ParsedSnapshot;
  readonly slider: DraftSlider;
  readonly published: PublishedState;
}

export async function loadPublished(
  clubId: string,
  registry: TextRegistry,
): Promise<PublishedState> {
  const head = await latestRelease(getDb(), clubId);
  if (head === null) {
    return { head, texts: new Map(), slider: EMPTY_SLIDER };
  }
  const release = await findRelease(getDb(), clubId, head.id);
  return {
    head,
    texts: parseSnapshot(release?.snapshot, registry)?.texts ?? new Map(),
    slider: snapshotSlider(release?.snapshot).slider,
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
  return { rows, draft: draftOverrides(rows, registry), slider, published };
}
