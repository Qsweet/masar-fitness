import { clubToday, hasPermission, parseRange } from "@masar/domain";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { OverviewHeader, RangeControl } from "@/components/admin/overview/header";
import { KpiCards, KpiStrip } from "@/components/admin/overview/kpis";
import {
  BackupAlertSection,
  LaunchSection,
  LeadText,
  PeriodSections,
  SidePanels,
  Slot,
} from "@/components/admin/overview/sections";
import { CardSkeleton, KpiSkeleton } from "@/components/admin/overview/skeleton";
import { Alert } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { formatCalendarDay, formatDay } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { loadHasOrders } from "@/server/admin/overview/period";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().overview.title };
}

type SearchParams = Awaited<PageProps<"/admin">["searchParams"]>;

function single(value: SearchParams[string]): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * نظرة عامة v2 (ADMIN_REDESIGN §5.1): قبل البيع قائمة إطلاق مبنية على حالة النظام وإجراءات سريعة وأصفار
 * بسببها؛ ومع الطلبات مؤشرات الفترة بفروقها، والإيراد اليومي، والمبيعات حسب الاشتراك، والقمع. الفترة
 * في الرابط بتقويم النادي، وكل رقم من القاعدة على الخادم، وكل قسم بصلاحيته وفي حدّه (Suspense)؛ لا
 * ينتظر الرأس إلا «هل للنادي طلب». المحرر يُحوَّل كما كان.
 */
export default async function OverviewPage(props: PageProps<"/admin">) {
  const { staff } = await requireStaff("account.self");
  if (!hasPermission(staff.role, "overview.read")) {
    redirect(
      hasPermission(staff.role, "content.read") ? ADMIN_ROUTES.contentTexts : ADMIN_ROUTES.account,
    );
  }
  const club = (await staffClub(staff.clubId)) ?? notFound();
  const now = new Date();
  const params = await props.searchParams;
  const { range, issue } = parseRange(
    { range: single(params.range), from: single(params.from), to: single(params.to) },
    now,
    club.timezone,
  );
  const hasOrders = await loadHasOrders(club);
  const dictionary = getAdminDictionary();
  const { overview } = dictionary;
  const section = { club, range, role: staff.role, now, dictionary };
  const today = clubToday(now, club.timezone);
  const days = { from: formatCalendarDay(range.from), to: formatCalendarDay(range.to) };
  return (
    <>
      <OverviewHeader
        eyebrow={fill(overview.today, { date: formatDay(now, club.timezone) })}
        title={fill(overview.greeting, { name: staff.displayName })}
        lead={
          <Suspense fallback={null}>
            <LeadText {...section} hasOrders={hasOrders} />
          </Suspense>
        }
      >
        <RangeControl
          range={range}
          text={overview.range}
          customLabel={fill(overview.range.describe.custom, days)}
          today={today}
        />
      </OverviewHeader>
      {issue === null ? null : <Alert tone="info">{overview.range.issues[issue]}</Alert>}
      <Suspense fallback={null}>
        <BackupAlertSection {...section} />
      </Suspense>
      {hasPermission(staff.role, "system.read") || !hasOrders ? (
        <Slot fallback={<CardSkeleton kind="chart" />} dictionary={dictionary}>
          <LaunchSection {...section} hasOrders={hasOrders} />
        </Slot>
      ) : null}
      {hasOrders ? (
        <Slot fallback={<KpiSkeleton />} dictionary={dictionary}>
          <KpiCards club={club} range={range} text={overview.kpis} />
        </Slot>
      ) : (
        <KpiStrip currency={club.currency} text={overview.kpis} />
      )}
      {hasOrders ? <PeriodSections {...section} /> : null}
      <SidePanels {...section} />
    </>
  );
}
