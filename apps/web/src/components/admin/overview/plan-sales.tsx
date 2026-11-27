import type { ClubSummary } from "@masar/db";
import { averageMinor, money, type DateRange } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { countText } from "@/i18n/count";
import { moneyParts } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { loadPlanSales } from "@/server/admin/overview/period";
import { Card, EmptyState } from "../ui/kit";
import charts from "./charts.module.css";
import { formatPercentTenths } from "./delta";

type PlansText = AdminDictionary["overview"]["plans"];

const FILLS = [
  charts.meterFill1,
  charts.meterFill2,
  charts.meterFill3,
  charts.meterFill4,
  charts.meterFill5,
];
const METER_WIDTH = 100;
const BPS_PER_TENTH = 10;
const BASIS = 10_000;

/** شريط نسبة: مسار وتعبئة بعرض الحصة (سمة SVG لا `style`، CSP). الأقدم/الأكبر من جهة البداية. */
export function Meter({
  bps,
  fillClass,
}: {
  readonly bps: number;
  readonly fillClass: string | undefined;
}) {
  const width = (Math.min(BASIS, Math.max(0, bps)) / BASIS) * METER_WIDTH;
  return (
    <svg
      className={charts.meter}
      viewBox={`0 0 ${String(METER_WIDTH)} 8`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect className={charts.meterTrack} width={METER_WIDTH} height={8} />
      <rect className={fillClass} x={METER_WIDTH - width} width={width} height={8} />
    </svg>
  );
}

interface PlanSalesCardProps {
  readonly club: ClubSummary;
  readonly range: DateRange;
  readonly text: PlansText;
}

/** المبيعات حسب الاشتراك (§5.1): المبلغ والعدد والحصة، وأكبر أربع ثم «غيرها»، ومتوسط قيمة الطلب. */
export async function PlanSalesCard({ club, range, text }: PlanSalesCardProps) {
  const view = await loadPlanSales(club, range);
  const sar = (minor: number) => moneyParts(money(minor, club.currency), "ar");
  const average = averageMinor(view.totalMinor, view.orders);
  return (
    <Card title={text.title} description={text.lead}>
      {view.shares.length === 0 ? (
        <EmptyState icon="plans" title={text.emptyTitle} />
      ) : (
        <>
          <ul className={charts.barList} data-testid="plan-sales">
            {view.shares.map((share, index) => {
              const value = sar(share.amount);
              return (
                <li key={share.item?.productId ?? "others"}>
                  <div className={charts.barRow}>
                    <span>{share.item?.nameAr ?? text.others}</span>
                    <span>
                      <bdi className={charts.barValue}>{value.amount}</bdi> {value.unit}
                      <span className={charts.barMeta}>
                        {countText(share.count, text.orders)} ·{" "}
                        <bdi>{formatPercentTenths(Math.round(share.bps / BPS_PER_TENTH))}</bdi>
                      </span>
                    </span>
                  </div>
                  <Meter bps={share.bps} fillClass={cx(FILLS[index % FILLS.length])} />
                </li>
              );
            })}
          </ul>
          {average === null ? null : (
            <p className={charts.average}>
              <span>{text.average}</span>
              <strong>
                <bdi>{sar(average).amount}</bdi> {sar(average).unit}
              </strong>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
