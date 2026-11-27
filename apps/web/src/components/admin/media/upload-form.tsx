import { ADMIN_ROUTES } from "@/config/admin";
import { MAX_UPLOAD_BYTES, MIN_IMAGE_SIDE } from "@/config/media-library";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { buttonClass, uiStyles } from "../ui/kit";
import styles from "./media.module.css";

const MIB = 1_048_576;

/**
 * نموذج الرفع (docs/ADMIN_A3_SLIDER.md §6.1): multipart عادي إلى Route Handler (حد الإجراءات 1MB)، يعمل
 * بلا JavaScript ويحوّل بعده إلى صفحة الصورة أو إلى المكتبة بالسبب.
 */
export function UploadForm({ text }: { readonly text: AdminDictionary["media"] }) {
  return (
    <form
      action={ADMIN_ROUTES.contentMediaUpload}
      method="post"
      encType="multipart/form-data"
      className={styles.upload}
    >
      <div className={uiStyles.field}>
        <label htmlFor="media-file" className={uiStyles.label}>
          {text.file}
        </label>
        <input
          id="media-file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className={styles.fileInput}
          aria-describedby="media-file-hint"
        />
        <p id="media-file-hint" className={uiStyles.hint}>
          {fill(text.uploadLead, {
            size: String(MAX_UPLOAD_BYTES / MIB),
            min: String(MIN_IMAGE_SIDE),
          })}
        </p>
      </div>
      <button type="submit" className={buttonClass({ variant: "primary" })}>
        {text.submit}
      </button>
    </form>
  );
}
