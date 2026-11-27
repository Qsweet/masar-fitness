import "server-only";
import { saveIntegration, type SecretChange } from "@masar/db";
import {
  acceptsTestEventCode,
  fieldsOf,
  hasPermission,
  isServerProvider,
  isTrackingProvider,
  isValidTestEventCode,
  parseIntegrationConfig,
  type TrackingProvider,
} from "@masar/domain";
import { isPlausibleSecret, MAX_SECRET_LENGTH, sealTrackingSecret } from "@masar/tracking";
import { getDb } from "../../db";
import { invalidateSiteTracking } from "../../tracking/site-config";
import { adminSecretKey } from "../flag";
import { textField } from "../form";
import type { StaffContext } from "../session";

const MAX_FIELD_LENGTH = 64;

export type SaveOutcome =
  | { readonly kind: "saved" | "unchanged"; readonly provider: TrackingProvider }
  | { readonly kind: "rejected"; readonly reason: string };

function reject(reason: string): SaveOutcome {
  return { kind: "rejected", reason };
}

/** المفتاح: فارغ يبقيه، و«احذف» تحذفه، وغيره يُختم بمفتاح فرعي من مفتاح اللوحة. لا يخرج نصًا. */
function secretChange(
  context: StaffContext,
  provider: TrackingProvider,
  formData: FormData,
): SecretChange | string {
  const input = textField(formData, "secret", MAX_SECRET_LENGTH).trim();
  const clear = formData.get("clearSecret") === "on";
  if (!isServerProvider(provider) || (input === "" && !clear)) {
    return { kind: "keep" };
  }
  if (!hasPermission(context.staff.role, "integrations.secrets")) {
    return "staff.invalid_request";
  }
  if (clear) {
    return { kind: "clear" };
  }
  if (!isPlausibleSecret(input)) {
    return "tracking.invalid_secret";
  }
  return {
    kind: "set",
    ...sealTrackingSecret(adminSecretKey(), context.staff.clubId, provider, input),
  };
}

function testCodeOf(provider: TrackingProvider, formData: FormData): string | null | undefined {
  const value = textField(formData, "testEventCode", MAX_FIELD_LENGTH).trim();
  if (!acceptsTestEventCode(provider) || value === "") {
    return null;
  }
  return isValidTestEventCode(value) ? value : undefined;
}

/** يقرأ نموذج المنصة ويتحقق منه كله على الخادم، ثم يحفظ بسطر تدقيق ويفرّغ ذاكرة الموقع. */
export async function saveIntegrationForm(
  context: StaffContext,
  formData: FormData,
): Promise<SaveOutcome> {
  const provider = textField(formData, "provider", MAX_FIELD_LENGTH);
  if (!isTrackingProvider(provider)) {
    return reject("staff.invalid_request");
  }
  const enabled = formData.get("enabled") === "on";
  const raw = Object.fromEntries(
    fieldsOf(provider).map((field) => [field, textField(formData, field, MAX_FIELD_LENGTH)]),
  );
  const parsed = parseIntegrationConfig(provider, raw, enabled);
  const issue = Object.entries(parsed.issues)[0];
  if (issue !== undefined) {
    return reject(`tracking.${issue[1]}_${issue[0]}`);
  }
  const testEventCode = testCodeOf(provider, formData);
  if (testEventCode === undefined) {
    return reject("tracking.invalid_test_code");
  }
  const secret = secretChange(context, provider, formData);
  if (typeof secret === "string") {
    return reject(secret);
  }
  const saved = await saveIntegration(getDb(), {
    clubId: context.staff.clubId,
    provider,
    enabled,
    config: parsed.config,
    testEventCode,
    secret,
    staffId: context.staff.id,
    actor: `staff:${context.staff.id}`,
    now: new Date(),
  });
  if (!saved.ok) {
    return reject("staff.invalid_request");
  }
  invalidateSiteTracking();
  return { kind: saved.value.changed ? "saved" : "unchanged", provider };
}
