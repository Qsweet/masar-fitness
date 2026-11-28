import "server-only";
import {
  latestRelease,
  previousRelease,
  releaseDetail,
  type ReleaseDetail,
  type ReleaseHead,
} from "@masar/db";
import {
  diffContent,
  diffSettings,
  diffSlider,
  type ContentChange,
  type SettingChange,
  type SliderChange,
} from "@masar/domain";
import { SITE_SETTING_DEFAULTS } from "@/config/site-settings";
import { getDb } from "../../db";
import { textRegistry } from "../../content/registry";
import { isUuid } from "../form";
import { publishedContent } from "./release";

/** إصدار للوحة: تفصيله، وفرقه عن سابقه، وآخر إصدار (هل هو المنشور الآن، ولرمز الاسترجاع). */
export interface ReleaseView {
  readonly release: ReleaseDetail;
  readonly changes: readonly ContentChange[];
  readonly sliderChanges: readonly SliderChange[];
  readonly settingChanges: readonly SettingChange[];
  readonly latest: ReleaseHead | null;
}

/** ما تغيّر بين لقطتين: النصوص والشريط والإعدادات. */
export interface ReleaseDiff {
  readonly changes: ContentChange[];
  readonly sliderChanges: SliderChange[];
  readonly settingChanges: SettingChange[];
}

function diffSnapshots(before: unknown, after: unknown): ReleaseDiff {
  const registry = textRegistry();
  const old = publishedContent(before, registry);
  const next = publishedContent(after, registry);
  return {
    changes: diffContent(old.texts, next.texts, registry),
    sliderChanges: diffSlider(old.slider, next.slider),
    settingChanges: diffSettings(old.settings, next.settings, SITE_SETTING_DEFAULTS),
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
