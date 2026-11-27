"use client";

import { openConsentSettings } from "./consent-cookie";

/** رابط التذييل الذي يعيد فتح شريط الموافقة لتغيير الاختيار أو سحبه (§3.2-5). */
export function PrivacySettingsButton({
  label,
  className,
}: {
  readonly label: string;
  readonly className?: string | undefined;
}) {
  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      {label}
    </button>
  );
}
