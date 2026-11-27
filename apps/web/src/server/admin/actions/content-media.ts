"use server";

import { deleteMediaAsset, staffActor } from "@masar/db";
import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { getDb } from "../../db";
import { getEnv } from "../../env";
import { logger } from "../../logger";
import { removeAssetFiles } from "../../media/store";
import { failed, idField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";

/**
 * حذف صورة من المكتبة نهائيًا (docs/ADMIN_A3_SLIDER.md §6.3): للمالك، ولصورة لا تستعملها شريحة في
 * المسودة ولا أي إصدار. الصف في معاملة تحت قفل المحتوى، والملفات بعد نجاحها.
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
  const deleted = await deleteMediaAsset(getDb(), {
    clubId: staff.clubId,
    assetId,
    actor: staffActor(staff.id),
    now: new Date(),
  });
  if (!deleted.ok) {
    return failed(deleted.error.reason);
  }
  const root = getEnv().MEDIA_DIR;
  if (root !== null) {
    // الصف حُذف: ملفات بلا صف لا تُخدَّم لأحد، فخطأ القرص يُسجَّل ولا يعيد الحذف
    await removeAssetFiles(root, staff.clubId, deleted.value.hash).catch((error: unknown) => {
      logger.error("media.files_delete_failed", { error });
    });
  }
  redirect(`${ADMIN_ROUTES.contentMedia}?done=media_asset_deleted`);
}
