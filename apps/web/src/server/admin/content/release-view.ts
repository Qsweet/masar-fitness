import "server-only";
import {
  latestRelease,
  previousRelease,
  releaseDetail,
  type ReleaseDetail,
  type ReleaseHead,
} from "@masar/db";
import { diffContent, diffSlider, type ContentChange, type SliderChange } from "@masar/domain";
import { getDb } from "../../db";
import { textRegistry } from "../../content/registry";
import { isUuid } from "../form";
import { publishedSlider, publishedTexts } from "./release";

/** إصدار للوحة: تفصيله، وفرقه عن سابقه، وآخر إصدار (هل هو المنشور الآن، ولرمز الاسترجاع). */
export interface ReleaseView {
  readonly release: ReleaseDetail;
  readonly changes: readonly ContentChange[];
  readonly sliderChanges: readonly SliderChange[];
  readonly latest: ReleaseHead | null;
}

/** ما تغيّر بين لقطتين: النصوص والشريط. */
export interface ReleaseDiff {
  readonly changes: ContentChange[];
  readonly sliderChanges: SliderChange[];
}

function diffSnapshots(before: unknown, after: unknown): ReleaseDiff {
  const registry = textRegistry();
  return {
    changes: diffContent(
      publishedTexts(before, registry),
      publishedTexts(after, registry),
      registry,
    ),
    sliderChanges: diffSlider(publishedSlider(before), publishedSlider(after)),
  };
}

export async function loadRelease(clubId: string, id: string): Promise<ReleaseView | null> {
  const db = getDb();
  const release = isUuid(id) ? await releaseDetail(db, clubId, id) : null;
  if (release === null) {
    return null;
  }
  const [previous, latest] = await Promise.all([
    previousRelease(db, clubId, release.seq),
    latestRelease(db, clubId),
  ]);
  return { release, ...diffSnapshots(previous?.snapshot ?? null, release.snapshot), latest };
}

/** ما سيعود لو استُرجع الإصدار: الفرق من المنشور الآن إليه. */
export async function rollbackChanges(clubId: string, view: ReleaseView): Promise<ReleaseDiff> {
  const current =
    view.latest === null ? null : await releaseDetail(getDb(), clubId, view.latest.id);
  return diffSnapshots(current?.snapshot ?? null, view.release.snapshot);
}
