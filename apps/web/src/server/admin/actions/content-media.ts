"use server";

import { deleteMediaAsset, staffActor } from "@masar/db";
import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { getDb } from "../../db";
import { getEnv } from "../../env";
import { removeAssetFiles } from "../../media/store";
import { failed, idField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";

/**
 * حذف صورة من المكتبة نهائيًا (docs/ADMIN_A3_SLIDER.md §6.3): للمالك، ولصورة لا تستعملها شريحة في
 * المسودة ولا أي إصدار. الصف والملفات في معاملة واحدة تحت قفل المحتوى (القرار 77).
 */
export async function deleteMediaAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("content.purge");
  const assetId = idField(formData, "id");
  if (assetId === null) {
    return failed("staff.invalid_request");
  }
  const { staff } = context;
  const root = getEnv().MEDIA_DIR;
  const deleted = await deleteMediaAsset(getDb(), {
    clubId: staff.clubId,
    assetId,
    actor: staffActor(staff.id),
    now: new Date(),
    // تحت قفل المحتوى: رفع الصورة نفسها في اللحظة نفسها ينتظر، فلا يبقى صف بلا ملفات
    removeFiles: (asset) =>
      root === null ? Promise.resolve() : removeAssetFiles(root, staff.clubId, asset.hash),
  });
  if (!deleted.ok) {
    return failed(deleted.error.reason);
  }
  redirect(`${ADMIN_ROUTES.contentMedia}?done=media_asset_deleted`);
}
