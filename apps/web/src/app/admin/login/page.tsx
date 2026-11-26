import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminForm } from "@/components/admin/admin-form";
import { TextField } from "@/components/admin/ui/fields";
import { Gate, gateStyles } from "@/components/admin/gate";
import { ADMIN_ROUTES, MAX_EMAIL_INPUT_LENGTH, MAX_PASSWORD_INPUT_LENGTH } from "@/config/admin";
import { getAdminDictionary } from "@/i18n/admin";
import { loginAction } from "@/server/admin/actions/login";
import { requireAdminOpen } from "@/server/admin/flag";
import { currentStaffSession } from "@/server/admin/session";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().login.title };
}

/**
 * صفحة الدخول: الوحيدة تحت اللوحة بلا `requireStaff` (لا جلسة بعد). أول سطر إغلاق اللوحة غير
 * المضبوطة، ومن له جلسة حيّة يُحوَّل إلى اللوحة (والحارس يوجّهه إلى خطوته).
 */
export default async function LoginPage() {
  requireAdminOpen();
  if ((await currentStaffSession()) !== null) {
    redirect(ADMIN_ROUTES.home);
  }
  const dictionary = getAdminDictionary();
  const { login, errors } = dictionary;
  return (
    <Gate dictionary={dictionary} title={login.title} lead={login.lead}>
      <AdminForm action={loginAction} labels={{ submit: login.submit, errors }}>
        <TextField
          id="login-email"
          name="email"
          type="email"
          label={login.email}
          autoComplete="username"
          inputMode="email"
          dir="ltr"
          maxLength={MAX_EMAIL_INPUT_LENGTH}
          required
        />
        <TextField
          id="login-password"
          name="password"
          type="password"
          label={login.password}
          autoComplete="current-password"
          dir="ltr"
          maxLength={MAX_PASSWORD_INPUT_LENGTH}
          required
        />
      </AdminForm>
      <p className={gateStyles.small}>{login.help}</p>
    </Gate>
  );
}
