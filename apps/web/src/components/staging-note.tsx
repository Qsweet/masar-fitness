import { isSiteIndexable } from "@/config/indexability";

interface StagingNoteProps {
  /** قيمة SITE_INDEXABLE كما هي في البيئة. */
  readonly rawIndexable: string | undefined;
  readonly text: string;
}

/**
 * شريط «نسخة معاينة» أعلى كل صفحة. مربوط بعلم الفهرسة نفسه: يظهر على النطاق المؤقت (غير قابل للفهرسة)
 * ولا يظهر أبدًا على الموقع الرسمي (SITE_INDEXABLE=true)، حتى لا يُقال للمشتري إن الأسعار ليست نهائية.
 */
export function StagingNote({ rawIndexable, text }: StagingNoteProps) {
  if (isSiteIndexable(rawIndexable)) {
    return null;
  }
  return (
    <p role="note" className="staging-note">
      {text}
    </p>
  );
}
