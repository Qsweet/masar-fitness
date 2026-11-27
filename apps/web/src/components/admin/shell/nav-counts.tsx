import { hasPermission, type StaffRole } from "@masar/domain";
import { Suspense, type ReactNode } from "react";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { awaitingPaymentCount, clubDraftSummary } from "@/server/admin/cached-reads";
import type { NavKey } from "./nav-model";
import styles from "./sidebar.module.css";

interface CountProps {
  readonly count: number;
  readonly tone: "accent" | "neutral";
  readonly label: string;
}

/** رقم في نهاية العنصر حين يعني فعلًا مطلوبًا فقط؛ الصفر لا يُرسم. */
function Count({ count, tone, label }: CountProps) {
  if (count === 0) {
    return null;
  }
  return (
    <span className={styles.count} data-tone={tone}>
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{fill(label, { count: String(count) })}</span>
    </span>
  );
}

async function AwaitingCount({ clubId, label }: { clubId: string; label: string }) {
  const count = await awaitingPaymentCount(clubId);
  return <Count count={count} tone="accent" label={label} />;
}

async function DraftCount({ clubId, label }: { clubId: string; label: string }) {
  const summary = await clubDraftSummary(clubId);
  const count = summary.changes.length + summary.sliderChanges.length;
  return <Count count={count} tone="neutral" label={label} />;
}

/**
 * عدّادات الشريط الجانبي (ADMIN_REDESIGN §4.1): «الطلبات» بانتظار الدفع الآن، و«النصوص» تعديلات المسودة
 * التي لم تُنشر. كلٌّ بصلاحية قسمه، ويُحسب على الخادم في حدّه الخاص فلا يؤخر الهيكل، ومرة واحدة
 * للطلب وإن رُسم مرتين (الشريط الجانبي والدرج).
 */
export function navCounts(
  role: StaffRole,
  clubId: string,
  text: AdminDictionary["shell"]["counts"],
): Partial<Record<NavKey, ReactNode>> {
  const counts: Partial<Record<NavKey, ReactNode>> = {};
  if (hasPermission(role, "orders.read")) {
    counts.orders = (
      <Suspense fallback={null}>
        <AwaitingCount clubId={clubId} label={text.awaiting} />
      </Suspense>
    );
  }
  if (hasPermission(role, "content.read")) {
    counts.contentTexts = (
      <Suspense fallback={null}>
        <DraftCount clubId={clubId} label={text.drafts} />
      </Suspense>
    );
  }
  return counts;
}
