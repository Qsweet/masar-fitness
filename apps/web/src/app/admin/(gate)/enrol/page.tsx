import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { TextField } from "@/components/admin/ui/fields";
import { Gate, gateStyles } from "@/components/admin/gate";
import { QrCode } from "@/components/admin/qr-code";
import { MAX_CODE_INPUT_LENGTH } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { confirmEnrolAction } from "@/server/admin/actions/mfa";
import { requireStaff } from "@/server/admin/guard";
import { enrolmentSetup } from "@/server/admin/mfa";

const SECRET_GROUP = /.{1,4}/g;

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().enrol.title };
}

/** تسجيل الخطوة الثانية عند أول دخول: رمز QR والمفتاح نصًا، ثم تأكيد برمز من التطبيق. */
export default async function EnrolPage() {
  const context = await requireStaff("account.self", "mfa_enrol");
  const setup = await enrolmentSetup(context);
  const dictionary = getAdminDictionary();
  const { enrol, errors } = dictionary;
  return (
    <Gate dictionary={dictionary} title={enrol.title} lead={enrol.lead} wide signedIn>
      <section className={gateStyles.stack}>
        <h2 className={gateStyles.step}>
          <span className={gateStyles.stepNumber}>1</span>
          {enrol.stepScan}
        </h2>
        <QrCode value={setup.uri} label={enrol.qrAlt} className={gateStyles.qr} />
        <p className={gateStyles.small}>{enrol.manualTitle}</p>
        <code className={gateStyles.secret} data-testid="totp-secret">
          {setup.secretBase32.match(SECRET_GROUP)?.join(" ")}
        </code>
      </section>
      <hr className={gateStyles.divider} />
      <h2 className={gateStyles.step}>
        <span className={gateStyles.stepNumber}>2</span>
        {enrol.stepConfirm}
      </h2>
      <AdminForm action={confirmEnrolAction} labels={{ submit: enrol.submit, errors }}>
        <TextField
          id="enrol-code"
          name="code"
          label={enrol.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={MAX_CODE_INPUT_LENGTH}
          required
          code
        />
      </AdminForm>
    </Gate>
  );
}
