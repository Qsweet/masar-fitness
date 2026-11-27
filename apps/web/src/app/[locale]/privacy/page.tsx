import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { ROUTES } from "@/config/routes";
import { defaultDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { pageMetadata } from "@/server/metadata";
import styles from "./page.module.css";

type Props = PageProps<"/[locale]/privacy">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return {};
  }
  const { meta } = defaultDictionary(locale).privacy;
  return pageMetadata({
    locale,
    path: ROUTES.privacy,
    title: meta.title,
    description: meta.description,
  });
}

/**
 * سياسة الخصوصية (ADMIN_A5_TRACKING §3.4): وصف لما يفعله الموقع فعلًا، من القاموس المقفل (`privacy`)،
 * بانتظار اعتماد المالك والمراجع القانوني.
 */
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const text = defaultDictionary(locale).privacy;
  return (
    <PageShell locale={locale} path={ROUTES.privacy}>
      <PageIntro title={text.title} lead={text.lead} />
      <div className={cx("container", styles.body)}>
        {text.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
