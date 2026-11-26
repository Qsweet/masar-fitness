import { MAX_PASSWORD_INPUT_LENGTH } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { TextField } from "./ui/fields";

interface NewPasswordFieldsProps {
  readonly idPrefix: string;
  /** بريد صاحب الحساب في حقل مخفي الظهور: مديرو كلمات المرور يربطون الكلمة الجديدة به. */
  readonly email: string;
  readonly text: AdminDictionary["passwordFields"];
  /** يُطلب عند التغيير الاختياري من «حسابي». */
  readonly withCurrent?: boolean;
}

/** حقول كلمة المرور الجديدة وتأكيدها (ومعها الحالية عند الطلب). السياسة تُفحص على الخادم. */
export function NewPasswordFields({ idPrefix, email, text, withCurrent }: NewPasswordFieldsProps) {
  const shared = { type: "password", dir: "ltr", maxLength: MAX_PASSWORD_INPUT_LENGTH } as const;
  return (
    <>
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      {withCurrent === true ? (
        <TextField
          id={`${idPrefix}-current`}
          name="currentPassword"
          label={text.current}
          autoComplete="current-password"
          required
          {...shared}
        />
      ) : null}
      <TextField
        id={`${idPrefix}-new`}
        name="newPassword"
        label={text.next}
        hint={text.nextHint}
        autoComplete="new-password"
        required
        {...shared}
      />
      <TextField
        id={`${idPrefix}-confirm`}
        name="confirmation"
        label={text.confirmation}
        autoComplete="new-password"
        required
        {...shared}
      />
    </>
  );
}
