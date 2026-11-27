"use client";

import ui from "@/components/admin/ui/ui.module.css";
import { errorPageAr } from "@/i18n/admin/error-ar";
import { cx } from "@/lib/cx";

interface PanelErrorProps {
  /** يعيد جلب مكوّنات الخادم ثم يعيد العرض. */
  readonly retry: () => void;
}

/**
 * عطل غير متوقع في أي صفحة من اللوحة لا حد خطأ أقرب لها («نظرة عامة»، الموظفون، السجل…): رسالة عامة
 * وزر إعادة داخل الهيكل. التفاصيل في سجل الخادم لا هنا. أصناف العدّة مباشرة لا مكوّناتها: مكوّن
 * متصفح، ومكوّنات العدّة تجرّ القاموس كله إلى حزمة كل صفحة.
 */
export default function PanelError({ retry }: PanelErrorProps) {
  return (
    <header className={ui.header}>
      <div className={ui.heading}>
        <h1 className={ui.title}>{errorPageAr.title}</h1>
        <p className={ui.description}>{errorPageAr.lead}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={cx(ui.button, ui.primary)}
      >
        {errorPageAr.retry}
      </button>
    </header>
  );
}
