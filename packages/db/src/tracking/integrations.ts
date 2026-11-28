/**
 * إعداد منصات الربط لكل نادٍ (ADMIN_A5_TRACKING §7–8). المفتاح المشفّر لا يخرج من هنا إلا لمن يرسل
 * (`loadSendableIntegration`)؛ القراءة للوحة ترجع «مضبوط · آخره» وحدها.
 */
import {
  isTrackingProvider,
  TRACKING_FIELDS,
  type IntegrationConfig,
  type TrackingField,
  type TrackingProvider,
} from "@masar/domain";
import type { Db } from "../client";
import type { StaffAuditActor } from "../commerce/audit";
import type { Tx } from "../commerce/transaction";

export const TRACKING_AUDIT_ENTITY = "tracking_integration";
export const TRACKING_AUDIT_ACTION = "tracking_integration_updated";
/** مفتاح «إرسال الجوال المجزّأ» في `config` (القرار 90-3). */
export const PHONE_FLAG = "sendHashedPhone";
/** تأكيد إطفاء المطابقة المتقدمة الآلية لـOpenAI في `config` (مراجعة القرار 91). */
export const AAM_FLAG = "aamDisabled";

export interface IntegrationView {
  readonly provider: TrackingProvider;
  readonly enabled: boolean;
  readonly config: IntegrationConfig;
  readonly secretLast4: string | null;
  readonly testEventCode: string | null;
  readonly updatedAt: Date | null;
}

interface IntegrationRow {
  readonly provider: string;
  readonly enabled: boolean;
  readonly config: unknown;
  readonly secret_enc: string | null;
  readonly secret_last4: string | null;
  readonly test_event_code: string | null;
  readonly updated_at: Date;
}

/** `config` JSONB كائن (CHECK)؛ تؤخذ منه الحقول المعروفة النصية، ومفتاح الجوال إن كان منطقيًّا. */
export function configOf(value: unknown): IntegrationConfig {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const config: Partial<Record<TrackingField, string>> = {};
  for (const field of TRACKING_FIELDS) {
    const item = Object.hasOwn(record, field) ? record[field] : undefined;
    if (typeof item === "string") {
      config[field] = item;
    }
  }
  const flag = (name: string) => {
    const value = Object.hasOwn(record, name) ? record[name] : undefined;
    return typeof value === "boolean" ? value : undefined;
  };
  const phone = flag(PHONE_FLAG);
  const aam = flag(AAM_FLAG);
  return {
    ...config,
    ...(phone === undefined ? {} : { sendHashedPhone: phone }),
    ...(aam === undefined ? {} : { aamDisabled: aam }),
  };
}

function viewOf(row: IntegrationRow): IntegrationView | null {
  if (!isTrackingProvider(row.provider)) {
    return null;
  }
  return {
    provider: row.provider,
    enabled: row.enabled,
    config: configOf(row.config),
    secretLast4: row.secret_last4,
    testEventCode: row.test_event_code,
    updatedAt: row.updated_at,
  };
}

async function readRows(db: Db | Tx, clubId: string): Promise<IntegrationRow[]> {
  return db.$queryRaw<IntegrationRow[]>`
    SELECT provider, enabled, config, secret_enc, secret_last4, test_event_code, updated_at
    FROM tracking_integrations WHERE club_id = ${clubId}::uuid`;
}

/** إعداد النادي للوحة: سطر لكل منصة محفوظة (ما لم يُحفظ قط غائب، والمستدعي يعرضه متوقفًا). */
export async function listIntegrations(db: Db, clubId: string): Promise<IntegrationView[]> {
  const rows = await readRows(db, clubId);
  return rows.map(viewOf).filter((view): view is IntegrationView => view !== null);
}

/** المنصات المفعّلة لنادي الموقع العام (أقدم نادٍ، القرار 71-4) بمعرّفاتها العامة، بلا مفاتيح. */
export async function siteIntegrations(db: Db): Promise<IntegrationView[]> {
  const rows = await db.$queryRaw<IntegrationRow[]>`
    SELECT provider, enabled, config, NULL::text AS secret_enc, NULL::text AS secret_last4,
      NULL::text AS test_event_code, updated_at
    FROM tracking_integrations
    WHERE enabled AND club_id = (SELECT id FROM clubs ORDER BY created_at, id LIMIT 1)`;
  return rows.map(viewOf).filter((view): view is IntegrationView => view !== null);
}

export interface SendableIntegration {
  readonly enabled: boolean;
  readonly config: IntegrationConfig;
  readonly secretEnc: string | null;
  readonly testEventCode: string | null;
}

/** ما يحتاجه المرسِل: المفتاح مشفّرًا كما حُفظ، ويفكه المرسِل بمفتاحه. */
export async function loadSendableIntegration(
  db: Db | Tx,
  clubId: string,
  provider: TrackingProvider,
): Promise<SendableIntegration | null> {
  const rows = await readRows(db, clubId);
  const row = rows.find((item) => item.provider === provider);
  return row === undefined
    ? null
    : {
        enabled: row.enabled,
        config: configOf(row.config),
        secretEnc: row.secret_enc,
        testEventCode: row.test_event_code,
      };
}

export type SecretChange =
  | { readonly kind: "keep" }
  | { readonly kind: "clear" }
  | { readonly kind: "set"; readonly sealed: string; readonly last4: string };

export interface SaveIntegrationInput {
  readonly clubId: string;
  readonly provider: TrackingProvider;
  readonly enabled: boolean;
  readonly config: IntegrationConfig;
  readonly testEventCode: string | null;
  readonly secret: SecretChange;
  readonly staffId: string;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}
