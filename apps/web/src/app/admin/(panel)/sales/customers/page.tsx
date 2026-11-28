import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { TextField } from "@/components/admin/ui/fields";
import { PageHeader } from "@/components/admin/ui/kit";
import { Disclosure, PointList, SettingsSection } from "@/components/admin/ui/section";
import { getAdminDictionary } from "@/i18n/admin";
import { lookupCustomerAction } from "@/server/admin/actions/sales-customers";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().sales.customers.title };
}

const MOBILE_MAX_LENGTH = 32;

/**
 * العملاء: بحث بالجوال الكامل وحده (POST ومطابقة تامة). لا قائمة تصفح ولا تصدير: الوصول إلى عميل
 * من طلبه أو من رقمه كاملًا فقط.
 */
export default async function CustomersPage() {
  await requireStaff("customers.read");
  const { sales, errors } = getAdminDictionary();
  const text = sales.customers;
  return (
    <>
      <PageHeader title={text.title} description={text.lead} />
      <SettingsSection title={text.lookup.title} description={text.lookup.sectionLead}>
        <AdminForm
          action={lookupCustomerAction}
          labels={{ submit: text.lookup.submit, errors }}
          inline
        >
          <TextField
            id="customer-mobile"
            name="mobile"
            type="tel"
            label={text.lookup.mobile}
            placeholder={text.lookup.mobilePlaceholder}
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            maxLength={MOBILE_MAX_LENGTH}
            required
            data-admin-search=""
          />
        </AdminForm>
        <Disclosure summary={text.lookup.emptyTitle}>
          <PointList lines={[text.lookup.emptyLead, text.lookup.mobileHint]} />
        </Disclosure>
      </SettingsSection>
    </>
  );
}
