"use client";

import { buttonClass, PageHeader } from "@/components/admin/ui/kit";
import { contentAr } from "@/i18n/admin/content-ar";

interface ContentErrorProps {
  /** يعيد جلب مكوّنات الخادم ثم يعيد العرض. */
  readonly retry: () => void;
}

/** عطل غير متوقع في صفحة من المحتوى: رسالة عامة وزر إعادة. التفاصيل في سجل الخادم لا هنا. */
export default function ContentError({ retry }: ContentErrorProps) {
  const text = contentAr.errorPage;
  return (
    <PageHeader title={text.title} description={text.lead}>
      <button
        type="button"
        onClick={() => {
          retry();
        }}
        className={buttonClass({ variant: "primary" })}
      >
        {text.retry}
      </button>
    </PageHeader>
  );
}
