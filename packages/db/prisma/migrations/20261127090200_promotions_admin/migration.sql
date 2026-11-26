-- المرحلة A2 (WP9): إدارة العروض من اللوحة (docs/ADMIN_A2_SALES.md §3).

-- رمز القفل المتفائل لنموذج التعديل: موظفان يعدّلان العرض نفسه، الثاني يُرفض.
ALTER TABLE "promotions"
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- P2: هوية العرض ثابتة بعد الإنشاء. الرمز مختوم في `order_discounts.code` لكل طلب استعمله، وفريد لكل
-- نادٍ على كل الحالات، فتغييره يحرر رمزًا استُعمل.
CREATE FUNCTION "promotions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.club_id, NEW.code, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.club_id, OLD.code, OLD.created_at) THEN
    RAISE EXCEPTION 'promotion_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "promotions_guard" BEFORE UPDATE ON "promotions"
  FOR EACH ROW EXECUTE FUNCTION "promotions_guard"();
