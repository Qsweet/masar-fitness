import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { TextField } from "@/components/admin/ui/fields";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui/kit";
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
      <Card title={text.lookup.title} narrow>
        <AdminForm action={lookupCustomerAction} labels={{ submit: text.lookup.submit, errors }}>
          <TextField
            id="customer-mobile"
            name="mobile"
            type="tel"
            label={text.lookup.mobile}
            hint={text.lookup.mobileHint}
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            maxLength={MOBILE_MAX_LENGTH}
            required
            data-admin-search=""
          />
        </AdminForm>
      </Card>
      <Card flush>
        <EmptyState
          icon="search"
          title={text.lookup.emptyTitle}
          description={text.lookup.emptyLead}
        />
      </Card>
    </>
  );
}
