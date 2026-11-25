"use client";

import { useParams } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { MAIN_CONTENT_ID } from "@/components/main-content-id";
import { ButtonLink, buttonClass } from "@/components/ui/button-link";
import { whatsappUrl } from "@/config/club";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, localizedPath } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import styles from "./error.module.css";

interface ErrorBoundaryProps {
  /** يعيد جلب مكوّنات الخادم ثم يعيد العرض (لا يكتفي بمسح حالة الخطأ). */
  readonly retry: () => void;
}

/**
 * عطل غير متوقع في صفحة: نقول ما حدث وما العمل، ونتيح إعادة المحاولة وقناة بديلة تعمل.
 * التفاصيل في سجل الخادم لا هنا.
 */
export default function LocaleError({ retry }: ErrorBoundaryProps) {
  const { locale: raw } = useParams<{ locale?: string }>();
  const locale = raw !== undefined && isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return (
    <main id={MAIN_CONTENT_ID}>
      <PageIntro title={dictionary.error.title} lead={dictionary.error.lead} />
      <div className={cx("container", styles.actions)}>
        <button
          type="button"
          onClick={() => {
            retry();
          }}
          className={buttonClass("primary")}
        >
          {dictionary.error.retry}
        </button>
        <ButtonLink
          href={whatsappUrl(dictionary.location.whatsappMessage)}
          variant="outline"
          external
        >
          {dictionary.location.whatsapp}
        </ButtonLink>
        <ButtonLink href={localizedPath(locale)} variant="outline">
          {dictionary.notFound.home}
        </ButtonLink>
      </div>
    </main>
  );
}
