"use client";

import { buttonClass, PageHeader } from "@/components/admin/ui/kit";
import { salesAr } from "@/i18n/admin/sales-ar";

interface SalesErrorProps {
  /** يعيد جلب مكوّنات الخادم ثم يعيد العرض. */
  readonly retry: () => void;
}

/**
 * عطل غير متوقع في صفحة من المبيعات: رسالة عامة وزر إعادة، داخل هيكل اللوحة. التفاصيل في سجل الخادم
 * (Next يسجّل الخطأ برقمه) لا هنا: لا نص SQL ولا بيان عميل يصل إلى المتصفح.
 */
export default function SalesError({ retry }: SalesErrorProps) {
  const text = salesAr.errorPage;
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
