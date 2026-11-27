import type { ClubSummary } from "@masar/db";
import {
  clubToday,
  hasPermission,
  launchSummary,
  parseRange,
  type DateRange,
  type LaunchEntry,
  type StaffRole,
} from "@masar/domain";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackupAlert } from "@/components/admin/backup/backup-alert";
import { FunnelCard } from "@/components/admin/overview/funnel-card";
import { OverviewHeader, RangeControl, rangeDescription } from "@/components/admin/overview/header";
import { KpiCards, KpiStrip } from "@/components/admin/overview/kpis";
import { LaunchCard } from "@/components/admin/overview/launch-card";
import layout from "@/components/admin/overview/overview.module.css";
import { ActivityFeed, RecentOrders, SystemCard } from "@/components/admin/overview/panels";
import { PlanSalesCard } from "@/components/admin/overview/plan-sales";
import { QuickActions } from "@/components/admin/overview/quick-actions";
import { RevenueCard } from "@/components/admin/overview/revenue-chart";
import { CardSkeleton, KpiSkeleton } from "@/components/admin/overview/skeleton";
import { actionEntriesFor, QUICK_ACTIONS } from "@/components/admin/shell/command-model";
import { Alert } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES, OVERVIEW_RECENT_ORDERS } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatCalendarDay, formatDay } from "@/i18n/admin/format";
import { countText } from "@/i18n/count";
import { fill } from "@/i18n/fill";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { loadLaunchChecklist } from "@/server/admin/overview/launch";
import { loadHasOrders } from "@/server/admin/overview/period";
import { loadActivity, loadSystem } from "@/server/admin/overview/side";
import { listRecentOrders } from "@masar/db";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().overview.title };
}

type SearchParams = Awaited<PageProps<"/admin">["searchParams"]>;

function single(value: SearchParams[string]): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** السطر تحت التحية: ما بقي قبل البيع، أو وصف الفترة حين توجد طلبات. */
function leadText(
  text: AdminDictionary["overview"],
  launch: readonly LaunchEntry[],
  hasOrders: boolean,
  range: DateRange,
): string {
  const open = launchSummary(launch).open.length;
  if (!hasOrders && open > 0) {
    return fill(text.lead.launch, { steps: countText(open, text.steps) });
  }
  if (!hasOrders && launch.length > 0) {
    return text.lead.launchWaiting;
  }
  const days = { from: formatCalendarDay(range.from), to: formatCalendarDay(range.to) };
  return fill(text.lead.data, { range: rangeDescription(range, text.range, days) });
}

interface SectionProps {
  readonly club: ClubSummary;
  readonly range: DateRange;
  readonly role: StaffRole;
  readonly now: Date;
  readonly dictionary: AdminDictionary;
}

/** قائمة الإطلاق بجانب الإجراءات السريعة، أو شريطها الرفيع حين يكتمل ما بيد الفريق. */
function LaunchRow({
  launch,
  hasOrders,
  role,
  dictionary,
}: Pick<SectionProps, "role" | "dictionary"> & {
  launch: readonly LaunchEntry[];
  hasOrders: boolean;
}) {
  const { overview } = dictionary;
  const quick = (
    <QuickActions
      actions={actionEntriesFor(role, dictionary, QUICK_ACTIONS)}
      text={overview.quick}
    />
  );
  const settled = launch.length === 0 || launchSummary(launch).settled;
  if (!settled) {
    return (
      <div className={layout.split}>
        <LaunchCard entries={launch} text={overview.launch} />
        {quick}
      </div>
    );
  }
  return (
    <>
      {launch.length === 0 ? null : <LaunchCard entries={launch} text={overview.launch} />}
      {hasOrders ? null : quick}
    </>
  );
}

/** بطاقات الفترة حين توجد طلبات: الرسم والاشتراكات، ثم آخر الطلبات والقمع. كلٌّ في حدّه. */
async function PeriodSections({ club, range, now, dictionary }: SectionProps) {
  const { overview } = dictionary;
  const orders = await listRecentOrders(getDb(), club.id, now, OVERVIEW_RECENT_ORDERS);
  const when = { now, timezone: club.timezone };
  return (
    <>
      <div className={layout.split}>
        <Suspense fallback={<CardSkeleton kind="chart" />}>
          <RevenueCard
            club={club}
            range={range}
            today={clubToday(now, club.timezone)}
            text={overview}
          />
        </Suspense>
        <Suspense fallback={<CardSkeleton kind="chart" />}>
          <PlanSalesCard club={club} range={range} text={overview.plans} />
        </Suspense>
      </div>
      <div className={layout.split}>
        <RecentOrders orders={orders} text={overview} {...when} />
        <Suspense fallback={<CardSkeleton kind="card" />}>
          <FunnelCard club={club} range={range} text={overview.funnel} />
        </Suspense>
      </div>
    </>
  );
}

interface SidePanelsProps {
  readonly activity: Awaited<ReturnType<typeof loadActivity>>;
  readonly system: Awaited<ReturnType<typeof loadSystem>>;
  readonly club: ClubSummary;
  readonly now: Date;
  readonly dictionary: AdminDictionary;
}

/** آخر النشاط (`audit.read`) وحالة النظام (`system.read`) متجاوران، كلٌّ بصلاحيته. */
function SidePanels({ activity, system, club, now, dictionary }: SidePanelsProps) {
  if (activity === null && system === null) {
    return null;
  }
  const { overview, backup } = dictionary;
  const when = { now, timezone: club.timezone };
  return (
    <div className={layout.halves}>
      {activity === null ? null : (
        <ActivityFeed items={activity} text={overview.activity} {...when} />
      )}
      {system === null ? null : (
        <SystemCard status={system} text={overview.system} backupText={backup} {...when} />
      )}
    </div>
  );
}

function Header({
  range,
  launch,
  hasOrders,
  club,
  now,
  name,
  text,
}: {
  readonly range: DateRange;
  readonly launch: readonly LaunchEntry[];
  readonly hasOrders: boolean;
  readonly club: ClubSummary;
  readonly now: Date;
  readonly name: string;
  readonly text: AdminDictionary["overview"];
}) {
  const days = { from: formatCalendarDay(range.from), to: formatCalendarDay(range.to) };
  return (
    <OverviewHeader
      eyebrow={fill(text.today, { date: formatDay(now, club.timezone) })}
      title={fill(text.greeting, { name })}
      lead={leadText(text, launch, hasOrders, range)}
    >
      <RangeControl
        range={range}
        text={text.range}
        customLabel={fill(text.range.describe.custom, days)}
        today={clubToday(now, club.timezone)}
      />
    </OverviewHeader>
  );
}

/**
 * نظرة عامة v2 (ADMIN_REDESIGN §5.1): قبل البيع قائمة إطلاق مبنية على حالة النظام وإجراءات سريعة وأصفار
 * بسببها؛ ومع الطلبات مؤشرات الفترة بفروقها، والإيراد اليومي، والمبيعات حسب الاشتراك، والقمع. الفترة
 * في الرابط بتقويم النادي، وكل رقم من القاعدة على الخادم، وكل قسم بصلاحيته. المحرر يُحوَّل كما كان.
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
  const [hasOrders, launch, activity, system] = await Promise.all([
    loadHasOrders(club),
    loadLaunchChecklist(club.id, staff.role, now),
    loadActivity(club, staff.role),
    loadSystem(club, staff.role),
  ]);
  const dictionary = getAdminDictionary();
  const { overview, backup } = dictionary;
  const section = { club, range, role: staff.role, now, dictionary };
  return (
    <>
      <Header
        {...{ range, launch, hasOrders, club, now }}
        name={staff.displayName}
        text={overview}
      />
      {issue === null ? null : <Alert tone="info">{overview.range.issues[issue]}</Alert>}
      {system === null ? null : <BackupAlert status={system.backup} text={backup} />}
      <LaunchRow launch={launch} hasOrders={hasOrders} role={staff.role} dictionary={dictionary} />
      {hasOrders ? (
        <Suspense fallback={<KpiSkeleton />}>
          <KpiCards club={club} range={range} now={now} text={overview.kpis} />
        </Suspense>
      ) : (
        <KpiStrip currency={club.currency} text={overview.kpis} />
      )}
      {hasOrders ? <PeriodSections {...section} /> : null}
      <SidePanels
        activity={activity}
        system={system}
        club={club}
        now={now}
        dictionary={dictionary}
      />
    </>
  );
}
