import type { ClubSummary } from "@masar/db";
import type { DateRange, FunnelDrop, FunnelStep as FunnelStepView } from "@masar/domain";
import type { AdminDictionary } from "@/i18n/admin";
import { fill, fillNodes } from "@/i18n/fill";
import { formatList, formatNumber } from "@/i18n/format";
import { loadFunnel } from "@/server/admin/overview/period";
import { AdminIcon } from "../admin-icon";
import { Card, EmptyState } from "../ui/kit";
import charts from "./charts.module.css";
import { formatPercentTenths } from "./delta";
import { Meter } from "./plan-sales";

type FunnelText = AdminDictionary["overview"]["funnel"];

const BPS_PER_TENTH = 10;
const percent = (bps: number) => formatPercentTenths(Math.round(bps / BPS_PER_TENTH));

function Drop({ drop, text, first }: { drop: FunnelDrop; text: FunnelText; first: boolean }) {
  if (drop.lost === 0) {
    return null;
  }
  const values = {
    count: <bdi key="count">{formatNumber(drop.lost)}</bdi>,
    percent: <bdi key="percent">{percent(drop.bps)}</bdi>,
  };
  const reasons = (["failed", "expired", "other"] as const)
    .filter((reason) => drop[reason] > 0)
    .map((reason) => fill(text.reasons[reason], { count: formatNumber(drop[reason]) }));
  const template = first
    ? text.lostBefore
    : reasons.length === 0
      ? text.lostAfter
      : text.lostAfterReasons;
  return (
    <li>
      <p className={charts.drop}>
        <AdminIcon name="down" size={12} />
        <span>{fillNodes(template, { ...values, reasons: formatList(reasons, "ar") })}</span>
      </p>
    </li>
  );
}

/**
 * من الطلب إلى الدفع (§5.1): ثلاث خطوات من القاعدة لطلبات الفترة، وسبب الفقد بين كل خطوتين. الزائر
 * قبل الطلب يحتاج التحليلات (A5) فلا يظهر.
 */
export async function FunnelCard({
  club,
  range,
  text,
}: {
  readonly club: ClubSummary;
  readonly range: DateRange;
  readonly text: FunnelText;
}) {
  const funnel = await loadFunnel(club, range);
  const [created, attempted, paid] = funnel.steps;
  return (
    <Card title={text.title} description={text.lead}>
      {created.count === 0 ? (
        <EmptyState icon="orders" title={text.emptyTitle} />
      ) : (
        <ol className={charts.funnel} data-testid="order-funnel">
          {[created, attempted, paid].map((step, index) => (
            <FunnelStep key={step.key} step={step} text={text} drop={funnel.drops[index - 1]} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function FunnelStep({
  step,
  text,
  drop,
}: {
  readonly step: FunnelStepView;
  readonly text: FunnelText;
  readonly drop: FunnelDrop | undefined;
}) {
  return (
    <>
      {drop === undefined ? null : (
        <Drop drop={drop} text={text} first={step.key === "attempted"} />
      )}
      <li className={charts.step}>
        <span className={charts.stepLabel}>{text.steps[step.key]}</span>
        <span className={charts.stepValue}>
          <bdi>{formatNumber(step.count)}</bdi>
          {step.key === "paid" ? (
            <>
              {" "}
              · <bdi>{percent(step.bps)}</bdi>
            </>
          ) : null}
        </span>
        <Meter
          bps={step.bps}
          fillClass={step.key === "paid" ? charts.stepFinal : charts.stepFill}
        />
      </li>
    </>
  );
}
