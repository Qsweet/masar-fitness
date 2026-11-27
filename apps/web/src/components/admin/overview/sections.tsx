import { listRecentOrders, type ClubSummary } from "@masar/db";
import { clubToday, hasPermission, type DateRange, type StaffRole } from "@masar/domain";
import { Suspense, type ReactNode } from "react";
import { OVERVIEW_RECENT_ORDERS } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { formatCalendarDay } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { loadLaunch } from "@/server/admin/overview/launch";
import { launchCounts } from "@/server/admin/overview/launch-view";
import { loadActivity, loadSystem } from "@/server/admin/overview/side";
import { getDb } from "@/server/db";
import { BackupAlert } from "../backup/backup-alert";
import { actionEntriesFor, QUICK_ACTIONS } from "../shell/command-model";
import { CardBoundary } from "./card-boundary";
import { FunnelCard } from "./funnel-card";
import { rangeDescription } from "./header";
import { LaunchCard, launchSentence } from "./launch-card";
import layout from "./overview.module.css";
import { ActivityFeed, RecentOrders, SystemCard } from "./panels";
import { PlanSalesCard } from "./plan-sales";
import { QuickActions } from "./quick-actions";
import { RevenueCard } from "./revenue-chart";
import { CardSkeleton } from "./skeleton";

/**
 * أقسام «نظرة عامة» المتدفقة (ADMIN_REDESIGN §5.1، §6.3): كل قسم في حدّه (Suspense) بهيكل بأبعاده، وحد
 * خطأ لبطاقته وحدها، فلا تؤخر بطاقة بطيئة الصفحة ولا يسقطها عطل بطاقة.
 */
export interface SectionProps {
  readonly club: ClubSummary;
  readonly range: DateRange;
  readonly role: StaffRole;
  readonly now: Date;
  readonly dictionary: AdminDictionary;
}

/** حد تحميل وحد خطأ لبطاقة واحدة. */
export function Slot({
  children,
  fallback,
  dictionary,
}: {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
  readonly dictionary: AdminDictionary;
}) {
  return (
    <CardBoundary message={dictionary.errorPage.card}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </CardBoundary>
  );
}

const YEAR_LENGTH = 4;
const yearOf = (day: string) => day.slice(0, YEAR_LENGTH);

/** السطر تحت التحية: جملة قائمة الإطلاق قبل البيع، أو وصف الفترة («حتى هذه اللحظة» إن بلغت الآن). */
export async function LeadText(props: SectionProps & { readonly hasOrders: boolean }) {
  const { club, range, role, now, dictionary, hasOrders } = props;
  const { overview } = dictionary;
  const launch = hasOrders ? null : await loadLaunch(club.id, role);
  if (launch !== null && !launchCounts(launch).settled) {
    return <>{launchSentence(launch, overview)}.</>;
  }
  const year = yearOf(clubToday(now, club.timezone));
  const withYear = yearOf(range.from) !== year || yearOf(range.to) !== year;
  const days = {
    from: formatCalendarDay(range.from, withYear),
    to: formatCalendarDay(range.to, withYear),
  };
  const ongoing = range.end.getTime() >= now.getTime();
  const template = ongoing ? overview.lead.data : overview.lead.dataPast;
  return <>{fill(template, { range: rangeDescription(range, overview.range, days) })}</>;
}

/** قائمة الإطلاق بجانب الإجراءات السريعة، أو شريطها الرفيع حين لا يبقى مفتوح لأحد. */
export async function LaunchSection({
  club,
  role,
  dictionary,
  hasOrders,
}: SectionProps & { readonly hasOrders: boolean }) {
  const { overview } = dictionary;
  const launch = await loadLaunch(club.id, role);
  const quick = (
    <QuickActions
      actions={actionEntriesFor(role, dictionary, QUICK_ACTIONS)}
      text={overview.quick}
    />
  );
  if (launch !== null && !launchCounts(launch).settled) {
    return (
      <div className={layout.split}>
        <LaunchCard view={launch} text={overview} />
        {quick}
      </div>
    );
  }
  return (
    <>
      {launch === null ? null : <LaunchCard view={launch} text={overview} />}
      {hasOrders ? null : quick}
    </>
  );
}

export async function BackupAlertSection({ club, role, dictionary }: SectionProps) {
  const system = await loadSystem(club.id, role);
  return system === null ? null : <BackupAlert status={system.backup} text={dictionary.backup} />;
}

async function RecentOrdersCard({ club, now, dictionary }: SectionProps) {
  const orders = await listRecentOrders(getDb(), club.id, now, OVERVIEW_RECENT_ORDERS);
  return (
    <RecentOrders orders={orders} text={dictionary.overview} now={now} timezone={club.timezone} />
  );
}

/** بطاقات الفترة حين توجد طلبات: الرسم والاشتراكات، ثم آخر الطلبات والقمع. */
export function PeriodSections(props: SectionProps) {
  const { club, range, now, dictionary } = props;
  const { overview } = dictionary;
  const chart = <CardSkeleton kind="chart" />;
  const card = <CardSkeleton kind="card" />;
  return (
    <>
      <div className={layout.split}>
        <Slot fallback={chart} dictionary={dictionary}>
          <RevenueCard
            club={club}
            range={range}
            today={clubToday(now, club.timezone)}
            text={overview}
          />
        </Slot>
        <Slot fallback={chart} dictionary={dictionary}>
          <PlanSalesCard club={club} range={range} text={overview.plans} />
        </Slot>
      </div>
      <div className={layout.split}>
        <Slot fallback={card} dictionary={dictionary}>
          <RecentOrdersCard {...props} />
        </Slot>
        <Slot fallback={card} dictionary={dictionary}>
          <FunnelCard club={club} range={range} text={overview.funnel} />
        </Slot>
      </div>
    </>
  );
}

async function ActivityCard({ club, role, now, dictionary }: SectionProps) {
  const activity = await loadActivity(club, role);
  return activity === null ? null : (
    <ActivityFeed
      items={activity}
      text={dictionary.overview.activity}
      now={now}
      timezone={club.timezone}
    />
  );
}

async function SystemSection({ club, role, now, dictionary }: SectionProps) {
  const system = await loadSystem(club.id, role);
  return system === null ? null : (
    <SystemCard
      status={system}
      text={dictionary.overview.system}
      backupText={dictionary.backup}
      now={now}
      timezone={club.timezone}
    />
  );
}

/** آخر النشاط (`audit.read`) وحالة النظام (`system.read`) متجاوران، كلٌّ بصلاحيته وفي حدّه. */
export function SidePanels(props: SectionProps) {
  const card = <CardSkeleton kind="card" />;
  const activity = hasPermission(props.role, "audit.read");
  const system = hasPermission(props.role, "system.read");
  if (!activity && !system) {
    return null;
  }
  return (
    <div className={layout.halves}>
      {activity ? (
        <Slot fallback={card} dictionary={props.dictionary}>
          <ActivityCard {...props} />
        </Slot>
      ) : null}
      {system ? (
        <Slot fallback={card} dictionary={props.dictionary}>
          <SystemSection {...props} />
        </Slot>
      ) : null}
    </div>
  );
}
