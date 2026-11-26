-- المرحلة A1: هوية موظفي لوحة التحكم (docs/ADMIN_DESIGN.md §4.2). الجزء الأول مولَّد من schema.prisma،
-- والجزء اليدوي بعده: قيود CHECK والمحفّزات التي لا يعبّر عنها Prisma.

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('owner', 'manager', 'editor', 'sales');

-- CreateEnum
CREATE TYPE "staff_status" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "staff_role" NOT NULL,
    "status" "staff_status" NOT NULL DEFAULT 'active',
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret_enc" TEXT,
    "totp_enabled_at" TIMESTAMPTZ(3),
    "totp_last_step" BIGINT,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "mfa_verified_at" TIMESTAMPTZ(3),
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_recovery_codes" (
    "id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "staff_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_club_id_role_status_idx" ON "staff_users"("club_id", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_user_id_revoked_at_idx" ON "staff_sessions"("staff_user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_recovery_codes_code_hash_key" ON "staff_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "staff_recovery_codes_staff_user_id_idx" ON "staff_recovery_codes"("staff_user_id");

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "staff_recovery_codes" ADD CONSTRAINT "staff_recovery_codes_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ═════════════ الجزء اليدوي: قيود CHECK ═════════════

ALTER TABLE "staff_users"
  -- صغير الحروف دائمًا، فالفهرس الفريد العادي يفرض الفرادة بلا حساسية حروف (parseStaffEmail في المجال)
  ADD CONSTRAINT "staff_users_email_shape"
    CHECK ("email" ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' AND char_length("email") <= 254),
  ADD CONSTRAINT "staff_users_display_name_length"
    CHECK ("display_name" = btrim("display_name") AND char_length("display_name") BETWEEN 2 AND 80),
  -- التجزئة بصيغتها النصية الحاملة للمعاملات، لا نص خام
  ADD CONSTRAINT "staff_users_password_hash_shape" CHECK ("password_hash" ~ '^scrypt\$'),
  ADD CONSTRAINT "staff_users_failed_logins_non_negative" CHECK ("failed_logins" >= 0),
  -- لا خطوة ثانية مفعّلة بلا سر، ولا خطوة مستعملة بلا سر
  ADD CONSTRAINT "staff_users_totp_enabled_has_secret"
    CHECK ("totp_enabled_at" IS NULL OR "totp_secret_enc" IS NOT NULL),
  ADD CONSTRAINT "staff_users_totp_step_has_secret"
    CHECK ("totp_last_step" IS NULL OR "totp_secret_enc" IS NOT NULL);

ALTER TABLE "staff_sessions"
  ADD CONSTRAINT "staff_sessions_token_hash_shape" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "staff_sessions_expiry_after_creation" CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "staff_sessions_seen_after_creation" CHECK ("last_seen_at" >= "created_at"),
  ADD CONSTRAINT "staff_sessions_ip_length" CHECK (char_length("ip") BETWEEN 1 AND 45),
  ADD CONSTRAINT "staff_sessions_user_agent_length" CHECK (char_length("user_agent") <= 255);

ALTER TABLE "staff_recovery_codes"
  ADD CONSTRAINT "staff_recovery_codes_hash_shape" CHECK ("code_hash" ~ '^[0-9a-f]{64}$');

-- التدقيق يقبل كيان الموظف، وفاعلًا بصيغة staff:<معرّف الموظف> بجانب القيم القائمة
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_entity_type_known";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entity_type_known"
  CHECK ("entity_type" IN ('order', 'membership', 'refund', 'assessment_request', 'payment_attempt', 'staff_user'));
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_known";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_known"
  CHECK ("actor" IN ('system', 'customer', 'staff', 'provider')
    OR "actor" ~ '^staff:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
-- صفحة سجل التدقيق تقرأ الأحدث أولًا لكل نادٍ
CREATE INDEX "audit_logs_club_id_created_at_idx" ON "audit_logs"("club_id", "created_at");

-- ═════════════ الجزء اليدوي: دوال trigger ═════════════
-- كل رسالة استثناء نص ثابت يطابقه الكود والاختبارات، كما في ترحيل البيع.

-- S1: مالك نشط واحد على الأقل لكل نادٍ. تعطيل آخر مالك نشط أو تنزيله مرفوض. القفل الاستشاري لكل
-- نادٍ يسلسل التغييرات المتزامنة، فلا يمرّ تنزيلان لمالكَين معًا وكلٌّ يرى الآخر نشطًا.
CREATE FUNCTION "staff_users_guard_last_owner"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."role" = 'owner' AND OLD."status" = 'active'
     AND (NEW."role" <> 'owner' OR NEW."status" <> 'active') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('staff_owners:' || OLD."club_id"::text, 0));
    IF NOT EXISTS (
      SELECT 1 FROM "staff_users"
      WHERE "club_id" = OLD."club_id" AND "id" <> OLD."id"
        AND "role" = 'owner' AND "status" = 'active'
    ) THEN
      RAISE EXCEPTION 'staff_last_owner_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "staff_users_guard_last_owner" BEFORE UPDATE ON "staff_users"
  FOR EACH ROW EXECUTE FUNCTION "staff_users_guard_last_owner"();

-- S2: الموظف لا يُحذف (سجل التدقيق والجلسات تشير إليه) ولا ينتقل بين الأندية؛ يُعطَّل فقط.
CREATE TRIGGER "staff_users_forbid_delete" BEFORE DELETE ON "staff_users"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('staff_user_delete_forbidden');

CREATE FUNCTION "staff_users_guard_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."club_id" IS DISTINCT FROM OLD."club_id" OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'staff_user_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "staff_users_guard_identity" BEFORE UPDATE ON "staff_users"
  FOR EACH ROW EXECUTE FUNCTION "staff_users_guard_identity"();

-- S3: الجلسة سجل: يتغير فيها آخر نشاط، وإثبات الخطوة الثانية والإلغاء يُكتبان مرة ولا يُمحيان.
-- تدوير الرمز صف جديد لا تعديل، فالرمز وصاحبه وموعد الانتهاء ثابتة.
CREATE FUNCTION "staff_sessions_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable CONSTANT text[] := ARRAY['last_seen_at', 'mfa_verified_at', 'revoked_at'];
BEGIN
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'staff_session_immutable';
  END IF;
  IF (OLD."revoked_at" IS NOT NULL AND NEW."revoked_at" IS DISTINCT FROM OLD."revoked_at")
     OR (OLD."mfa_verified_at" IS NOT NULL AND NEW."mfa_verified_at" IS DISTINCT FROM OLD."mfa_verified_at") THEN
    RAISE EXCEPTION 'staff_session_final';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "staff_sessions_guard_update" BEFORE UPDATE ON "staff_sessions"
  FOR EACH ROW EXECUTE FUNCTION "staff_sessions_guard_update"();
CREATE TRIGGER "staff_sessions_forbid_delete" BEFORE DELETE ON "staff_sessions"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('staff_session_delete_forbidden');

-- S4: رمز الاسترجاع يُستعمل مرة: used_at يُكتب مرة ولا يُمحى، والرمز وصاحبه ثابتان. الحذف مسموح
-- (إعادة الضبط تستبدل المجموعة كلها).
CREATE FUNCTION "staff_recovery_codes_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."code_hash" IS DISTINCT FROM OLD."code_hash"
     OR NEW."staff_user_id" IS DISTINCT FROM OLD."staff_user_id"
     OR OLD."used_at" IS NOT NULL THEN
    RAISE EXCEPTION 'staff_recovery_code_used_once';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "staff_recovery_codes_guard_update" BEFORE UPDATE ON "staff_recovery_codes"
  FOR EACH ROW EXECUTE FUNCTION "staff_recovery_codes_guard_update"();
