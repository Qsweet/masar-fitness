import "server-only";
import { draftSliderState, findRelease, listDraftEntries, loadDraftSlider } from "@masar/db";
import {
  draftOverrides,
  hasPermission,
  parseSnapshot,
  snapshotSlider,
  type SliderState,
  type TextOverrides,
} from "@masar/domain";
import { cookies } from "next/headers";
import { PREVIEW_DRAFT } from "@/config/admin";
import { isAdminEnabled, adminSecretKey } from "../admin/flag";
import { currentStaffSession } from "../admin/session";
import { getDb } from "../db";
import { getEnv } from "../env";
import { logger } from "../logger";
import { openPreview, previewCookieName } from "./preview-cookie";
import { textRegistry } from "./registry";

/**
 * معاينة الموظف (ADMIN_A3_CONTENT §8.3): الكوكي المختوم وحده لا يكفي؛ يلزم معه جلسة الموظف نفسه كاملة
 * (بعد الخطوة الثانية) بصلاحية `content.read`، وإنهاء الجلسة ينهي المعاينة. أي فشل ⇒ null، فيرى الطلب
 * المنشور بصمت. بلا كوكي لا قراءة إضافية: الزائر لا يدفع ثمن المعاينة.
 */
export type PreviewTarget =
  | { readonly kind: "draft" }
  | { readonly kind: "release"; readonly seq: number };

export interface PreviewTexts {
  readonly target: PreviewTarget;
  readonly releaseId: string | null;
  readonly overrides: TextOverrides;
  /** شريط المسودة أو الإصدار المعاين (ADMIN_A3_SLIDER §7). */
  readonly slider: SliderState;
}

async function textsFor(clubId: string, target: string): Promise<PreviewTexts | null> {
  const registry = textRegistry();
  if (target === PREVIEW_DRAFT) {
    const [rows, slider] = await Promise.all([
      listDraftEntries(getDb(), clubId),
      loadDraftSlider(getDb(), clubId),
    ]);
    return {
      target: { kind: "draft" },
      releaseId: null,
      overrides: draftOverrides(rows, registry).texts,
      slider: draftSliderState(slider),
    };
  }
  const release = await findRelease(getDb(), clubId, target);
  if (release === null) {
    return null;
  }
  return {
    target: { kind: "release", seq: release.seq },
    releaseId: release.id,
    overrides: parseSnapshot(release.snapshot, registry)?.texts ?? new Map(),
    slider: snapshotSlider(release.snapshot).slider,
  };
}

async function readPreview(): Promise<PreviewTexts | null> {
  const value = (await cookies()).get(previewCookieName(getEnv().SITE_URL))?.value;
  if (value === undefined || !isAdminEnabled()) {
    return null;
  }
  const payload = openPreview(adminSecretKey(), value, new Date());
  const current = payload === null ? null : await currentStaffSession();
  if (
    payload === null ||
    current?.stage !== "full" ||
    current.staff.id !== payload.staffId ||
    !hasPermission(current.staff.role, "content.read")
  ) {
    return null;
  }
  return textsFor(current.staff.clubId, payload.target);
}

export async function previewTexts(): Promise<PreviewTexts | null> {
  try {
    return await readPreview();
  } catch (error) {
    logger.error("content.preview_failed", { error });
    return null;
  }
}
