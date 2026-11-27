"use server";

import { moveSlideInDraft, removeSlide, staffActor } from "@masar/db";
import { isMoveDirection } from "@masar/domain";
import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { rejectedForm, type FieldFormState } from "../field-form";
import { failed, idField, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { getDb } from "../../db";
import { saveSettings, saveSlide } from "../slider/save-slide";
import { readSlideValues } from "../slider/slide-form";

const SHORT_INPUT = 20;
const CHECKED = "on";

function listWith(query: string): never {
  redirect(`${ADMIN_ROUTES.contentSlider}?${query}`);
}

/** إنشاء شريحة في المسودة أو حفظ تعديلها برمز قفلها. */
export async function saveSlideAction(
  _previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("content.write");
  const values = readSlideValues(formData);
  const saved = await saveSlide(context, values, new Date());
  if (!saved.ok) {
    return rejectedForm(values, saved.error);
  }
  listWith(`done=${saved.value.created ? "content_slide_created" : "content_slide_updated"}`);
}

/** تحريك شريحة خطوة في المسودة (زرا «أعلى» و«أسفل» في القائمة، بلا JavaScript). */
export async function moveSlideAction(formData: FormData): Promise<void> {
  const context = await requireStaff("content.write");
  const id = idField(formData, "id");
  const direction = textField(formData, "direction", SHORT_INPUT);
  if (id === null || !isMoveDirection(direction)) {
    listWith("error=staff.invalid_request");
  }
  const { staff } = context;
  const moved = await moveSlideInDraft(getDb(), {
    clubId: staff.clubId,
    staffId: staff.id,
    actor: staffActor(staff.id),
    now: new Date(),
    id,
    direction,
  });
  listWith(moved.ok ? "done=content_slide_moved" : `error=${moved.error.reason}`);
}

/** إزالة شريحة من المسودة بعد صفحة التأكيد. */
export async function removeSlideAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("content.write");
  const id = idField(formData, "id");
  if (id === null) {
    return failed("staff.invalid_request");
  }
  const { staff } = context;
  const removed = await removeSlide(getDb(), {
    clubId: staff.clubId,
    staffId: staff.id,
    actor: staffActor(staff.id),
    now: new Date(),
    id,
    lockToken: textField(formData, "lockToken", SHORT_INPUT),
  });
  if (!removed.ok) {
    return failed(removed.error.reason);
  }
  listWith("done=content_slide_removed");
}

/** إعدادات الشريط في المسودة. */
export async function saveSliderSettingsAction(
  _previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("content.write");
  const values = {
    autoplay: textField(formData, "autoplay", SHORT_INPUT),
    interval: textField(formData, "interval", SHORT_INPUT),
  };
  const saved = await saveSettings(
    context,
    {
      autoplay: values.autoplay === CHECKED,
      intervalSeconds: values.interval,
      lockToken: textField(formData, "lockToken", SHORT_INPUT),
    },
    new Date(),
  );
  if (!saved.ok) {
    return rejectedForm(values, saved.error);
  }
  listWith("done=content_slider_settings_saved");
}
