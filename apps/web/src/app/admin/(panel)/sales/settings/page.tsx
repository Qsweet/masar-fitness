import { getSalesSettings } from "@masar/db";
import { basisPoints, checkoutBlockers, CURRENCIES } from "@masar/domain";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/sales/settings-form";
import { Alert, Card, Facts, Ltr, Notice, noticeText, PageHeader } from "@/components/admin/ui/kit";
import { getAdminDictionary } from "@/i18n/admin";
import { requireStaff } from "@/server/admin/guard";
import { formatRate } from "@/server/admin/sales/catalog-view";
import { providerMinimumWindow } from "@/server/admin/sales/settings";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.settings.title };
}

/**
 * إعدادات البيع للمالك: مهلة دفع الطلب وقاعدة بدء الاشتراك، ومع كل قيمة ما يترتب عليها. بلا قيمة
 * افتراضية ولا مقترحة: ما لم يُحسم يبقى فارغًا والشراء مغلقًا به، والصفحة تقول ذلك بما تحسبه
 * `checkoutBlockers` نفسها. الضريبة والعملة والمنطقة الزمنية للقراءة.
 */
export default async function SalesSettingsPage(props: PageProps<"/admin/sales/settings">) {
  const { staff } = await requireStaff("sales.settings");
  const query = await props.searchParams;
  const settings = await getSalesSettings(getDb(), staff.clubId);
  const dictionary = getAdminDictionary();
  const text = dictionary.sales.settings;
  const blockers = checkoutBlockers(
    {
      vatRate: basisPoints(settings.vatRateBps),
      currency: CURRENCIES.find((currency) => currency === settings.currency) ?? "SAR",
      timeZone: settings.timezone,
      orderPaymentWindowMinutes: settings.orderPaymentWindowMinutes,
      membershipStartRule: settings.membershipStartRule,
    },
    "membership",
  );
  return (
    <>
      <PageHeader title={text.title} description={text.lead} />
      <Notice text={noticeText(query.done, dictionary)} />
      {blockers.length === 0 ? null : (
        <Alert tone="warning">
          <span data-testid="settings-undecided">
            <strong>{text.undecidedTitle}.</strong>{" "}
            {blockers.map((blocker) => text.undecided[blocker]).join(" ")}
          </span>
        </Alert>
      )}
      <Card title={text.formTitle} narrow>
        <SettingsForm
          lockToken={settings.lockToken}
          values={{
            windowMinutes: String(settings.orderPaymentWindowMinutes ?? ""),
            startRule: settings.membershipStartRule ?? "",
          }}
          startRuleUnset={settings.membershipStartRule === null}
          providerMinimum={providerMinimumWindow()}
          text={text}
          errors={dictionary.errors}
        />
      </Card>
      <Card title={text.readonly.title} description={text.readonly.lead} narrow>
        <Facts
          items={[
            [text.readonly.vat, <bdi key="vat">{formatRate(settings.vatRateBps)}</bdi>],
            [text.readonly.currency, <Ltr key="currency">{settings.currency}</Ltr>],
            [text.readonly.timezone, <Ltr key="timezone">{settings.timezone}</Ltr>],
          ]}
        />
      </Card>
    </>
  );
}
