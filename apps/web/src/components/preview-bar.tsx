import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import type { PreviewTarget } from "@/server/content/preview";
import styles from "./preview-bar.module.css";

/**
 * شريط معاينة المحتوى أعلى الصفحة العامة (ADMIN_A3_CONTENT §8.3): يقول للموظف إن ما يراه غير منشور، ومعه
 * رابط الخروج. نصه من قاموس اللوحة (عربي في اللغتين: للموظف لا للزائر)، ولا يُرسم لغير المعاينة.
 */
export function PreviewBar({ target }: { readonly target: PreviewTarget | null }) {
  if (target === null) {
    return null;
  }
  const text = getAdminDictionary().content.previewBar;
  const label =
    target.kind === "draft" ? text.draft : fill(text.release, { seq: String(target.seq) });
  return (
    <div
      role="region"
      aria-label={text.label}
      className={styles.bar}
      lang="ar"
      dir="rtl"
      data-testid="preview-bar"
    >
      <p className={styles.text}>
        <strong>{label}</strong> <span>{text.note}</span>
      </p>
      <a href={ADMIN_ROUTES.contentPreviewExit} className={styles.exit}>
        {text.exit}
      </a>
    </div>
  );
}
