import "server-only";
import { getSalesSettings, staffActor, updateSalesSettings } from "@masar/db";
import {
  PROVIDER_SESSION_MARGIN_MINUTES,
  err,
  ok,
  validateSalesSettings,
  type Result,
  type SalesSettings,
} from "@masar/domain";
import { getDb } from "../../db";
import { getEnv } from "../../env";
import {
  failureOf,
  formFailure,
  type FormFailure,
  type FormIntent,
  type FormValues,
} from "../field-form";
import type { StaffContext } from "../session";

/**
 * إعدادات البيع باسم المالك (ADMIN_A2_SALES §9). بلا قيمة افتراضية ولا مقترحة: ما لم يُكتب يبقى غير
 * محسوم والشراء مغلقًا به. الحفظ يمر بخطوة مراجعة تعيد عرض القديم والجديد.
 */
export const SETTINGS_LIMITS = { windowMinutes: 16, startRule: 32 } as const;

/**
 * أقل مهلة يقبلها مزوّد الدفع المضبوط في هذا النشر: أقل وقت معقول للدفع مع هامش جلسة المزوّد
 * (PHASE4_PAYMENTS_DESIGN §5.6). null بلا مزوّد.
 */
export function providerMinimumWindow(): number | null {
  const { PAYMENTS } = getEnv();
  return PAYMENTS.mode === "off"
    ? null
    : PAYMENTS.minPaymentMinutes + PROVIDER_SESSION_MARGIN_MINUTES;
}

export type SettingsOutcome =
  | { readonly kind: "review"; readonly current: SalesSettings; readonly next: SalesSettings }
  | { readonly kind: "saved" };

function unchanged(current: SalesSettings, next: SalesSettings): boolean {
  return (
    current.orderPaymentWindowMinutes === next.orderPaymentWindowMinutes &&
    current.membershipStartRule === next.membershipStartRule
  );
}

export async function saveSalesSettings(
  context: StaffContext,
  input: { lockToken: string; values: FormValues; intent: FormIntent },
  now: Date,
): Promise<Result<SettingsOutcome, FormFailure>> {
  const clubId = context.staff.clubId;
  const current = await getSalesSettings(getDb(), clubId);
  const settings = validateSalesSettings(
    { windowMinutes: input.values.windowMinutes ?? "", startRule: input.values.startRule ?? "" },
    { current, minimumWindowMinutes: providerMinimumWindow() },
  );
  if (!settings.ok) {
    return err(failureOf(settings.error));
  }
  if (input.intent !== "confirm") {
    return unchanged(current, settings.value)
      ? err(formFailure("sales_settings.no_changes"))
      : ok({ kind: "review", current, next: settings.value });
  }
  const saved = await updateSalesSettings(getDb(), {
    clubId,
    lockToken: input.lockToken,
    settings: settings.value,
    actor: staffActor(context.staff.id),
    now,
  });
  return saved.ok ? ok({ kind: "saved" }) : err(failureOf(saved.error));
}
