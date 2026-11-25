-- المرحلة 4أ: أساس الدفع الإلكتروني (docs/PHASE4_PAYMENTS_DESIGN.md §5.2 و§5.6 و§5.8 و§6.1).
-- الجزء الأول مولَّد من schema.prisma، والجزء الثاني يدوي: قيود CHECK ودوال trigger.
-- جدولا provider_events و payment_transactions في التصميم مؤجَّلان إلى ترحيل لاحق (القرار 49).

-- CreateEnum
CREATE TYPE "payment_attempt_status" AS ENUM ('created', 'pending', 'authorized', 'captured', 'failed', 'voided', 'expired', 'refunded');

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "method" TEXT,
    "status" "payment_attempt_status" NOT NULL DEFAULT 'created',
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "provider_session_id" TEXT,
    "provider_payment_id" TEXT,
    "provider_status" TEXT,
    "provider_mode" TEXT NOT NULL,
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "sync_lease_until" TIMESTAMPTZ(3),
    "settled_at" TIMESTAMPTZ(3),
    "settlement_result" TEXT,
    "failure_reason" TEXT,
    "last_checked_at" TIMESTAMPTZ(3),
    "check_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "pending_at" TIMESTAMPTZ(3),
    "authorized_at" TIMESTAMPTZ(3),
    "captured_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_incidents" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "attempt_id" UUID,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "resolution" TEXT,
    "resolved_by" TEXT,

    CONSTRAINT "payment_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_idx" ON "payment_attempts"("order_id");

-- CreateIndex
CREATE INDEX "payment_attempts_status_deadline_at_idx" ON "payment_attempts"("status", "deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_provider_session_id_key" ON "payment_attempts"("provider", "provider_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_provider_payment_id_key" ON "payment_attempts"("provider", "provider_payment_id");

-- CreateIndex
CREATE INDEX "payment_incidents_order_id_idx" ON "payment_incidents"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_incidents_attempt_id_kind_key" ON "payment_incidents"("attempt_id", "kind");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_incidents" ADD CONSTRAINT "payment_incidents_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_incidents" ADD CONSTRAINT "payment_incidents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_incidents" ADD CONSTRAINT "payment_incidents_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;



-- ═════════════ الجزء اليدوي: قيود CHECK (الاسم <table>_<rule>) ═════════════

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_provider_shape" CHECK ("provider" ~ '^[a-z][a-z0-9_]{1,31}$'),
  ADD CONSTRAINT "payment_attempts_provider_mode_known" CHECK ("provider_mode" IN ('test', 'live')),
  ADD CONSTRAINT "payment_attempts_amount_positive" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "payment_attempts_check_count_non_negative" CHECK ("check_count" >= 0),
  ADD CONSTRAINT "payment_attempts_deadline_after_creation" CHECK ("deadline_at" > "created_at"),
  -- لا جلسة بلا معرّفها، ولا تحصيل بلا معرّف دفعته
  ADD CONSTRAINT "payment_attempts_session_required" CHECK (
    "status" NOT IN ('pending', 'authorized', 'captured', 'voided', 'refunded')
    OR "provider_session_id" IS NOT NULL),
  ADD CONSTRAINT "payment_attempts_payment_required" CHECK (
    "status" NOT IN ('captured', 'refunded') OR "provider_payment_id" IS NOT NULL),
  -- نتيجة التسوية ووقتها يُكتبان معًا، ولا تسوية بلا دفعة
  ADD CONSTRAINT "payment_attempts_settlement_complete"
    CHECK (("settled_at" IS NULL) = ("settlement_result" IS NULL)),
  ADD CONSTRAINT "payment_attempts_settlement_has_payment"
    CHECK ("settled_at" IS NULL OR "provider_payment_id" IS NOT NULL),
  ADD CONSTRAINT "payment_attempts_failure_reason_state"
    CHECK (("status" = 'failed') = ("failure_reason" IS NOT NULL)),
  ADD CONSTRAINT "payment_attempts_ended_state"
    CHECK (("status" IN ('failed', 'voided', 'expired', 'refunded')) = ("ended_at" IS NOT NULL));

ALTER TABLE "payment_incidents"
  ADD CONSTRAINT "payment_incidents_kind_known" CHECK ("kind" IN (
    'late_payment_not_payable', 'amount_mismatch', 'currency_mismatch', 'order_already_paid',
    'payment_already_used', 'coupon_applied_by_provider', 'unknown_reference', 'provider_reversed',
    'stuck_pending', 'capture_blocked', 'capture_failed')),
  ADD CONSTRAINT "payment_incidents_data_object" CHECK (jsonb_typeof("data") = 'object'),
  -- أعمدة الحسم الثلاثة تُكتب معًا أو لا تُكتب
  ADD CONSTRAINT "payment_incidents_resolution_complete"
    CHECK (num_nonnulls("resolved_at", "resolution", "resolved_by") IN (0, 3));

-- التدقيق يقبل كيان محاولة الدفع
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_entity_type_known";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entity_type_known"
  CHECK ("entity_type" IN ('order', 'membership', 'refund', 'assessment_request', 'payment_attempt'));

-- ═════════════ الجزء اليدوي: دوال trigger ═════════════

-- المحاولة الحيّة: لم تبلغ حالة نهائية، أو حُصّلت ولم تُسجَّل تسويتها. تعريف واحد تستعمله T8 و T9
-- واستعلامات الكود، ويطابق isLiveAttempt في المجال.
CREATE FUNCTION "payment_attempt_is_live"("status" "payment_attempt_status", "settled_at" timestamptz)
  RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT "status" IN ('created', 'pending', 'authorized') OR ("status" = 'captured' AND "settled_at" IS NULL)
$$;

-- T8: محاولة الدفع. عند الإدراج تقفل الطلب وتطابقه (معلّق، المبلغ والعملة والنادي، الموعد قبل المهلة،
-- ولا محاولة حيّة أخرى: لا فهارس جزئية، ومحاولتان متزامنتان قد تُنتجان دفعتين). بعده: المراجع والمبلغ
-- ثابتة، ومعرّفا المزوّد والتسوية تُكتب مرة، والحالة تتقدم فقط والنهائي نهائي.
CREATE FUNCTION "payment_attempts_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  head record;
  progress CONSTANT "payment_attempt_status"[] := ARRAY['created', 'pending', 'authorized', 'captured'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT club_id, status, total_minor, currency, expires_at INTO head
      FROM "orders" WHERE id = NEW.order_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN NEW; -- المفتاح الأجنبي يرفضه
    END IF;
    IF NEW.status <> 'created' OR NEW.settled_at IS NOT NULL OR NEW.provider_session_id IS NOT NULL
       OR NEW.provider_payment_id IS NOT NULL THEN
      RAISE EXCEPTION 'payment_attempt_initial_state';
    END IF;
    IF head.status <> 'pending_payment' THEN
      RAISE EXCEPTION 'payment_attempt_order_not_pending';
    END IF;
    IF (NEW.club_id, NEW.amount_minor, NEW.currency) IS DISTINCT FROM (head.club_id, head.total_minor, head.currency) THEN
      RAISE EXCEPTION 'payment_attempt_snapshot_mismatch';
    END IF;
    IF NEW.deadline_at >= head.expires_at THEN
      RAISE EXCEPTION 'payment_attempt_deadline_after_expiry';
    END IF;
    IF EXISTS (SELECT 1 FROM "payment_attempts" a
                WHERE a.order_id = NEW.order_id AND "payment_attempt_is_live"(a.status, a.settled_at)) THEN
      RAISE EXCEPTION 'payment_attempt_live_exists';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.club_id, NEW.order_id, NEW.provider, NEW.provider_mode, NEW.amount_minor, NEW.currency,
      NEW.deadline_at, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.club_id, OLD.order_id, OLD.provider, OLD.provider_mode, OLD.amount_minor, OLD.currency,
      OLD.deadline_at, OLD.created_at) THEN
    RAISE EXCEPTION 'payment_attempt_terms_immutable';
  END IF;
  IF (OLD.provider_session_id IS NOT NULL AND NEW.provider_session_id IS DISTINCT FROM OLD.provider_session_id)
     OR (OLD.provider_payment_id IS NOT NULL AND NEW.provider_payment_id IS DISTINCT FROM OLD.provider_payment_id) THEN
    RAISE EXCEPTION 'payment_attempt_reference_immutable';
  END IF;
  IF OLD.settled_at IS NOT NULL
     AND (NEW.settled_at, NEW.settlement_result) IS DISTINCT FROM (OLD.settled_at, OLD.settlement_result) THEN
    RAISE EXCEPTION 'payment_attempt_settlement_immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('failed', 'voided', 'expired', 'refunded') THEN
      RAISE EXCEPTION 'payment_attempt_status_final';
    END IF;
    -- التقدم بترتيب الجدول، والمال المحجوز أو المحصَّل لا يصير failed ولا expired
    IF (NEW.status = ANY(progress) AND array_position(progress, NEW.status) <= array_position(progress, OLD.status))
       OR (NEW.status IN ('failed', 'expired') AND OLD.status NOT IN ('created', 'pending'))
       OR (NEW.status = 'expired' AND OLD.status <> 'pending')
       OR (NEW.status = 'voided' AND OLD.status NOT IN ('authorized', 'captured'))
       OR (NEW.status = 'refunded' AND OLD.status <> 'captured') THEN
      RAISE EXCEPTION 'payment_attempt_status_backward';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_attempts_guard" BEFORE INSERT OR UPDATE ON "payment_attempts"
  FOR EACH ROW EXECUTE FUNCTION "payment_attempts_guard"();
CREATE TRIGGER "payment_attempts_forbid_delete" BEFORE DELETE ON "payment_attempts"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('payment_attempt_delete_forbidden');

-- T9: سدّ احتياطي للشرط الصلب 2. الطلب لا يُكتب منتهيًا ما دامت له محاولة حيّة، ولو نسي الكود الاستثناء.
-- الدالة VOLATILE فاستعلامها يأخذ لقطة جديدة في READ COMMITTED ويرى كل محاولة اعتُمدت قبله.
CREATE FUNCTION "orders_forbid_expiry_with_live_attempt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment_attempts" a
              WHERE a.order_id = NEW.id AND "payment_attempt_is_live"(a.status, a.settled_at)) THEN
    RAISE EXCEPTION 'order_expiry_blocked_by_live_attempt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_forbid_expiry_with_live_attempt" BEFORE UPDATE ON "orders"
  FOR EACH ROW WHEN (NEW.status = 'expired' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION "orders_forbid_expiry_with_live_attempt"();

-- T10: الحادثة للإلحاق فقط. عند الإدراج تطابق طلبها (ومحاولتها إن وُجدت)، وبعده لا يُكتب إلا الحسم ومرة واحدة.
CREATE FUNCTION "payment_incidents_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.resolved_at IS NOT NULL
       OR NOT EXISTS (SELECT 1 FROM "orders" o WHERE o.id = NEW.order_id AND o.club_id = NEW.club_id)
       OR (NEW.attempt_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM "payment_attempts" a WHERE a.id = NEW.attempt_id AND a.order_id = NEW.order_id)) THEN
      RAISE EXCEPTION 'payment_incident_reference_mismatch';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.club_id, NEW.order_id, NEW.attempt_id, NEW.kind, NEW.data, NEW.opened_at)
     IS DISTINCT FROM
     (OLD.id, OLD.club_id, OLD.order_id, OLD.attempt_id, OLD.kind, OLD.data, OLD.opened_at) THEN
    RAISE EXCEPTION 'payment_incident_append_only';
  END IF;
  IF OLD.resolved_at IS NOT NULL
     AND (NEW.resolved_at, NEW.resolution, NEW.resolved_by)
         IS DISTINCT FROM (OLD.resolved_at, OLD.resolution, OLD.resolved_by) THEN
    RAISE EXCEPTION 'payment_incident_resolution_final';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_incidents_guard" BEFORE INSERT OR UPDATE ON "payment_incidents"
  FOR EACH ROW EXECUTE FUNCTION "payment_incidents_guard"();
CREATE TRIGGER "payment_incidents_forbid_delete" BEFORE DELETE ON "payment_incidents"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('payment_incident_delete_forbidden');
