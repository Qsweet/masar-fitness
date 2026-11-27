import {
  automaticZeroedNames,
  getPromotionDetail,
  getSalesSettings,
  type PromotionAdminRow,
} from "@masar/db";
import {
  decidePromotionStatus,
  isPromotionStatusAction,
  type PromotionStatusAction,
} from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import { Alert, ButtonLink, Card, Facts, PageHeader, uiStyles } from "@/components/admin/ui/kit";
import { promotionPath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { setPromotionStatusAction } from "@/server/admin/actions/sales-promotions";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { promotionFacts } from "@/server/admin/sales/promotions-view";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.breadcrumbs.promotionStatus };
}

interface ConfirmProps {
  readonly row: PromotionAdminRow;
  readonly action: PromotionStatusAction;
  readonly timezone: string;
  readonly dictionary: AdminDictionary;
}

/** ما سيُفعَّل (للتفعيل وحده)، ثم العواقب والزر. */
function ConfirmCards({ row, action, timezone, dictionary }: ConfirmProps) {
  const text = dictionary.sales.promotions.status;
  return (
    <>
      {action === "activate" ? (
        <Card title={text.termsTitle} narrow>
          <div data-testid="promotion-terms">
            <Facts
              items={promotionFacts(row, timezone, dictionary).map(
                ([label, value]) => [label, <bdi key={label}>{value}</bdi>] as const,
              )}
            />
          </div>
        </Card>
      ) : null}
      <Card title={text.consequencesTitle} narrow>
        <ul className={uiStyles.consequences}>
          {text.consequences[action].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <AdminForm
          action={setPromotionStatusAction}
          labels={{ submit: text.submit[action], errors: dictionary.errors }}
          variant={action === "end" ? "danger" : "primary"}
        >
          <input type="hidden" name="promotionId" value={row.rule.id} />
          <input type="hidden" name="lockToken" value={row.lockToken} />
          <input type="hidden" name="action" value={action} />
        </AdminForm>
      </Card>
    </>
  );
}

/** الإجراء متاح: التأكيد، أو أسماء المنتجات التي يجعلها الخصم مجانية بدل الزر. */
function Available({
  confirm,
  zeroed,
}: {
  readonly confirm: ConfirmProps;
  readonly zeroed: readonly string[];
}) {
  const text = confirm.dictionary.sales.promotions.status;
  return zeroed.length > 0 ? (
    <Alert tone="danger">{fill(text.zeroes, { names: zeroed.join("»، «") })}</Alert>
  ) : (
    <ConfirmCards {...confirm} />
  );
}

/** عرض تلقائي يجعل منتجًا يُباع مجانيًا لا يُفعَّل: أسماء المنتجات تحل محل الزر. */
async function zeroedBy(row: PromotionAdminRow, clubId: string): Promise<string[]> {
  const names = await automaticZeroedNames(getDb(), clubId, row.rule, new Date());
  return names.map((name) => name.ar);
}

/**
 * تأكيد تفعيل عرض أو إيقافه أو إنهائه. التفعيل يعيد عرض الخصم والنطاق والنافذة والحدّين قبل الزر،
 * والإنهاء يقول إنه نهائي وإن الرمز لا يُعاد استعماله. صفحة من الخادم تعمل بلا JavaScript.
 */
export default async function PromotionStatusPage(
  props: PageProps<"/admin/sales/promotions/[id]/status">,
) {
  const { staff } = await requireStaff("promotions.write");
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const db = getDb();
  const row = isUuid(id) ? await getPromotionDetail(db, staff.clubId, id, new Date()) : undefined;
  const action = isPromotionStatusAction(query.to) ? query.to : undefined;
  if (row === undefined || action === undefined) {
    notFound();
  }
  const dictionary = getAdminDictionary();
  const text = dictionary.sales.promotions.status;
  const decision = decidePromotionStatus(row.rule.status, action);
  const available = decision.ok && !decision.value.replay;
  const club = await getSalesSettings(db, staff.clubId);
  const zeroed = available && action === "activate" ? await zeroedBy(row, staff.clubId) : [];
  return (
    <>
      <PageHeader
        title={text.title[action]}
        description={available ? fill(text.lead[action], { name: row.rule.name.ar }) : undefined}
      >
        <ButtonLink href={promotionPath(row.rule.id)} variant="ghost">
          {text.back}
        </ButtonLink>
      </PageHeader>
      {available ? (
        <Available confirm={{ row, action, timezone: club.timezone, dictionary }} zeroed={zeroed} />
      ) : (
        <Alert tone="warning">{text.unavailable}</Alert>
      )}
    </>
  );
}
