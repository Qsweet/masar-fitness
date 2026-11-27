import "server-only";
import {
  latestRelease,
  previousRelease,
  releaseDetail,
  type ReleaseDetail,
  type ReleaseHead,
} from "@masar/db";
import { diffContent, type ContentChange } from "@masar/domain";
import { getDb } from "../../db";
import { textRegistry } from "../../content/registry";
import { isUuid } from "../form";
import { publishedTexts } from "./release";

/** إصدار للوحة: تفصيله، وفرقه عن سابقه، وآخر إصدار (هل هو المنشور الآن، ولرمز الاسترجاع). */
export interface ReleaseView {
  readonly release: ReleaseDetail;
  readonly changes: readonly ContentChange[];
  readonly latest: ReleaseHead | null;
}

export async function loadRelease(clubId: string, id: string): Promise<ReleaseView | null> {
  const db = getDb();
  const release = isUuid(id) ? await releaseDetail(db, clubId, id) : null;
  if (release === null) {
    return null;
  }
  const registry = textRegistry();
  const [previous, latest] = await Promise.all([
    previousRelease(db, clubId, release.seq),
    latestRelease(db, clubId),
  ]);
  const changes = diffContent(
    publishedTexts(previous?.snapshot ?? null, registry),
    publishedTexts(release.snapshot, registry),
    registry,
  );
  return { release, changes, latest };
}

/** ما سيعود لو استُرجع الإصدار: الفرق من المنشور الآن إليه. */
export async function rollbackChanges(clubId: string, view: ReleaseView): Promise<ContentChange[]> {
  const registry = textRegistry();
  const current =
    view.latest === null ? null : await releaseDetail(getDb(), clubId, view.latest.id);
  return diffContent(
    publishedTexts(current?.snapshot ?? null, registry),
    publishedTexts(view.release.snapshot, registry),
    registry,
  );
}
