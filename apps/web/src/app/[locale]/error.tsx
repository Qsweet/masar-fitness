"use client";

import { useParams } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";

interface ErrorBoundaryProps {
  readonly reset: () => void;
}

/** عطل غير متوقع في صفحة: نقول ما حدث وما العمل، ونتيح إعادة المحاولة. التفاصيل في سجل الخادم. */
export default function LocaleError({ reset }: ErrorBoundaryProps) {
  const { locale: raw } = useParams<{ locale?: string }>();
  const locale = raw !== undefined && isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return (
    <main className="surface-deep py-24 md:py-32">
      <div className="page-container">
        <h1 className="text-title font-display">{dictionary.error.title}</h1>
        <p className="text-muted mt-4 max-w-prose text-lead">{dictionary.error.lead}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-10 inline-flex min-h-12 cursor-pointer items-center rounded-full bg-lane-500 px-6 font-strong text-ink-900 transition-colors duration-(--duration-press) hover:bg-lane-600"
        >
          {dictionary.error.retry}
        </button>
      </div>
    </main>
  );
}
