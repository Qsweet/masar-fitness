"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { MAIN_CONTENT_ID } from "@/components/page-shell";
import { whatsappUrl } from "@/config/club";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, localizedPath } from "@/i18n/locales";

interface ErrorBoundaryProps {
  /** يعيد جلب مكوّنات الخادم ثم يعيد العرض (لا يكتفي بمسح حالة الخطأ). */
  readonly retry: () => void;
}

const LINK = "font-strong underline underline-offset-4";

/**
 * عطل غير متوقع في صفحة: نقول ما حدث وما العمل، ونتيح إعادة المحاولة وقناة بديلة تعمل.
 * التفاصيل في سجل الخادم لا هنا.
 */
export default function LocaleError({ retry }: ErrorBoundaryProps) {
  const { locale: raw } = useParams<{ locale?: string }>();
  const locale = raw !== undefined && isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return (
    <main id={MAIN_CONTENT_ID} className="surface-deep min-h-dvh py-24 md:py-32">
      <div className="page-container">
        <h1 className="text-title font-display">{dictionary.error.title}</h1>
        <p className="text-muted mt-4 max-w-prose text-lead">{dictionary.error.lead}</p>
        <button
          type="button"
          onClick={() => {
            retry();
          }}
          className="mt-10 inline-flex min-h-13 cursor-pointer items-center rounded-full bg-lane-500 px-7 font-strong text-ink-900 transition-colors duration-(--duration-press) hover:bg-lane-600"
        >
          {dictionary.error.retry}
        </button>
        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          <li>
            <a
              href={whatsappUrl(dictionary.location.whatsappMessage)}
              rel="noopener noreferrer"
              className={LINK}
            >
              {dictionary.location.whatsapp}
            </a>
          </li>
          <li>
            <Link href={localizedPath(locale)} className={LINK}>
              {dictionary.notFound.home}
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
