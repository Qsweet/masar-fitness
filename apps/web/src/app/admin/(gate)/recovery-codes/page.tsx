import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminButton } from "@/components/admin/fields";
import { Gate, gateStyles } from "@/components/admin/gate";
import { ADMIN_ROUTES } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { acknowledgeRecoveryCodesAction } from "@/server/admin/actions/mfa";
import { readFlash } from "@/server/admin/flash";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().recoveryCodes.title };
}

/**
 * رموز الاسترجاع بعد التسجيل مباشرة: تُعرض من كوكي مشفّر قصير العمر حتى يؤكد الموظف أنه حفظها، ثم
 * لا تُعرض ثانية (في القاعدة تجزئاتها فقط). بلا رموز منتظرة تحوَّل الصفحة إلى اللوحة.
 */
export default async function RecoveryCodesPage() {
  const { staff } = await requireStaff("account.self");
  const flash = await readFlash(staff.id);
  if (flash?.kind !== "recovery_codes") {
    redirect(ADMIN_ROUTES.home);
  }
  const dictionary = getAdminDictionary();
  const { recoveryCodes } = dictionary;
  return (
    <Gate dictionary={dictionary} title={recoveryCodes.title} lead={recoveryCodes.lead} wide>
      <ul className={gateStyles.codes} aria-label={recoveryCodes.listLabel}>
        {flash.values.map((code) => (
          <li key={code}>
            <code className={gateStyles.secret} data-testid="recovery-code">
              {code}
            </code>
          </li>
        ))}
      </ul>
      <form action={acknowledgeRecoveryCodesAction}>
        <button type="submit" className={adminButton("primary", true)}>
          {recoveryCodes.confirm}
        </button>
      </form>
    </Gate>
  );
}
