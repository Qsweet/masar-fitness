import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { TextField } from "@/components/admin/ui/fields";
import { Gate, gateStyles } from "@/components/admin/gate";
import { MAX_CODE_INPUT_LENGTH } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { verifyRecoveryAction, verifyTotpAction } from "@/server/admin/actions/mfa";
import { requireStaff } from "@/server/admin/guard";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().verify.title };
}

/** الخطوة الثانية لجلسة دخلت بكلمة المرور: رمز التطبيق، أو رمز استرجاع لمن فقد جواله. */
export default async function VerifyPage() {
  await requireStaff("account.self", "mfa_verify");
  const dictionary = getAdminDictionary();
  const { verify, errors } = dictionary;
  return (
    <Gate dictionary={dictionary} title={verify.title} lead={verify.lead} signedIn>
      <AdminForm action={verifyTotpAction} labels={{ submit: verify.submit, errors }}>
        <TextField
          id="verify-code"
          name="code"
          label={verify.code}
          hint={verify.codeHint}
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={MAX_CODE_INPUT_LENGTH}
          required
          code
        />
      </AdminForm>
      <hr className={gateStyles.divider} />
      <details className={gateStyles.details}>
        <summary>{verify.recoveryTitle}</summary>
        <div className={gateStyles.detailsBody}>
          <p className={gateStyles.small}>{verify.recoveryLead}</p>
          <AdminForm
            action={verifyRecoveryAction}
            variant="secondary"
            labels={{ submit: verify.recoverySubmit, errors }}
          >
            <TextField
              id="verify-recovery"
              name="code"
              label={verify.recoveryCode}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              dir="ltr"
              maxLength={MAX_CODE_INPUT_LENGTH}
              required
            />
          </AdminForm>
          <p className={gateStyles.small}>{verify.lost}</p>
        </div>
      </details>
    </Gate>
  );
}
