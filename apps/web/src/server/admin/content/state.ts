import "server-only";
import {
  findRelease,
  latestRelease,
  listDraftEntries,
  type DraftRow,
  type ReleaseHead,
} from "@masar/db";
import {
  draftOverrides,
  parseSnapshot,
  type ParsedSnapshot,
  type TextOverrides,
  type TextRegistry,
} from "@masar/domain";
import { getDb } from "../../db";

/**
 * حالة محتوى النادي للوحة: صفوف المسودة (برموز قفلها)، وتجاوزاتها الفعلية والمعطّل منها، وآخر إصدار
 * وتجاوزاته. اللوحة تقرأ نادي الموظف؛ الموقع العام يقرأ نادي المحتوى (`siteClubId`).
 */
export interface PublishedState {
  readonly head: ReleaseHead | null;
  readonly texts: TextOverrides;
}

export interface ContentState {
  readonly rows: readonly DraftRow[];
  readonly draft: ParsedSnapshot;
  readonly published: PublishedState;
}

export async function loadPublished(
  clubId: string,
  registry: TextRegistry,
): Promise<PublishedState> {
  const head = await latestRelease(getDb(), clubId);
  if (head === null) {
    return { head, texts: new Map() };
  }
  const release = await findRelease(getDb(), clubId, head.id);
  return { head, texts: parseSnapshot(release?.snapshot, registry)?.texts ?? new Map() };
}

export async function loadContentState(
  clubId: string,
  registry: TextRegistry,
): Promise<ContentState> {
  const [rows, published] = await Promise.all([
    listDraftEntries(getDb(), clubId),
    loadPublished(clubId, registry),
  ]);
  return { rows, draft: draftOverrides(rows, registry), published };
}
