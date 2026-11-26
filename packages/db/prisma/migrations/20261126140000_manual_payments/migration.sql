-- المرحلة A2 (WP4): الدفع اليدوي من اللوحة (docs/ADMIN_A2_SALES.md §6.5). الجزء الأول مولَّد من
-- schema.prisma، والجزء اليدوي بعده: قيود CHECK والمحفّزان T12 و T13.

-- CreateTable
CREATE TABLE "manual_payments" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "external_reference" TEXT NOT NULL,
    "received_on" DATE NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "note" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "manual_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_payments_order_id_key" ON "manual_payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "manual_payments_club_id_method_external_reference_key" ON "manual_payments"("club_id", "method", "external_reference");

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ═════════════ الجزء اليدوي: قيود CHECK ═════════════

ALTER TABLE "manual_payments"
  -- طرق الدفع اليدوي قائمة مغلقة (MANUAL_PAYMENT_METHODS في المجال)
  ADD CONSTRAINT "manual_payments_method_known" CHECK ("method" IN ('bank_transfer', 'paid_at_club')),
  -- مرجع الحوالة أو رقم سند القبض إلزامي ومشذَّب
  ADD CONSTRAINT "manual_payments_external_reference_shape"
    CHECK ("external_reference" = btrim("external_reference")
      AND char_length("external_reference") BETWEEN 3 AND 64),
  ADD CONSTRAINT "manual_payments_amount_positive" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "manual_payments_currency_shape" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "manual_payments_note_length"
    CHECK ("note" IS NULL OR ("note" = btrim("note") AND char_length("note") BETWEEN 1 AND 500));

-- ═════════════ الجزء اليدوي: دوال trigger ═════════════
-- كل رسالة استثناء نص ثابت يطابقه الكود والاختبارات، كما في ترحيلات البيع والدفع.

-- T12: الدفعة اليدوية للإلحاق فقط. عند الإدراج تقفل الطلب وتطابقه: معلّق، والنادي والمبلغ والعملة
-- لقطته، وبلا محاولة دفع حيّة (العميل يدفع الآن عند المزوّد). بدء محاولة يأخذ القفل نفسه (T8)، فإحداهما
-- تسبق والأخرى تُرفض.
CREATE FUNCTION "manual_payments_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  head record;
BEGIN
  SELECT club_id, status, total_minor, currency INTO head
    FROM "orders" WHERE id = NEW.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW; -- المفتاح الأجنبي يرفضه
  END IF;
  IF head.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'manual_payment_order_not_pending';
  END IF;
  IF (NEW.club_id, NEW.amount_minor, NEW.currency) IS DISTINCT FROM (head.club_id, head.total_minor, head.currency) THEN
    RAISE EXCEPTION 'manual_payment_snapshot_mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM "payment_attempts" a
              WHERE a.order_id = NEW.order_id AND "payment_attempt_is_live"(a.status, a.settled_at)) THEN
    RAISE EXCEPTION 'manual_payment_blocked_by_live_attempt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "manual_payments_guard" BEFORE INSERT ON "manual_payments"
  FOR EACH ROW EXECUTE FUNCTION "manual_payments_guard"();
CREATE TRIGGER "manual_payments_forbid_mutation" BEFORE UPDATE OR DELETE ON "manual_payments"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('manual_payment_immutable');

-- T13: لا صف يدوي بلا تسوية، ولا تسوية يدوية بلا صف.
-- (أ) عند COMMIT (مؤجَّل، فالإدراج يسبق التسوية داخل المعاملة): الطلب يحمل هذه الدفعة بعينها.
CREATE FUNCTION "manual_payment_settlement_link"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "orders" o
                  WHERE o.id = NEW.order_id AND o.paid_provider = 'manual'
                    AND o.paid_provider_payment_id = NEW.id::text) THEN
    RAISE EXCEPTION 'manual_payment_requires_settlement';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "manual_payment_settlement_link" AFTER INSERT ON "manual_payments"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "manual_payment_settlement_link"();

-- (ب) الطلب لا يُكتب مدفوعًا «يدويًا» إلا وصف دفعته موجود له بالمعرّف نفسه والمبلغ نفسه.
CREATE FUNCTION "orders_require_manual_payment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "manual_payments" m
                  WHERE m.order_id = NEW.id AND m.id::text = NEW.paid_provider_payment_id
                    AND m.amount_minor = NEW.paid_amount_minor AND m.currency = NEW.paid_currency) THEN
    RAISE EXCEPTION 'order_manual_payment_missing';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_require_manual_payment" BEFORE UPDATE ON "orders"
  FOR EACH ROW WHEN (NEW.paid_provider = 'manual' AND OLD.paid_provider IS DISTINCT FROM NEW.paid_provider)
  EXECUTE FUNCTION "orders_require_manual_payment"();
