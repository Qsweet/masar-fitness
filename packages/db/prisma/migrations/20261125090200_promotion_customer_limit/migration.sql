-- T4 (مراجعة): الحدّان باسمين ثابتين مختلفين، فيُبلَّغ العميل بالسبب الصحيح لو بلغ السدّ الأخير.
-- الحد الكلي يُفحص أولًا: إن نفد العرض للجميع فهذا هو السبب الصادق ولو بلغ العميل حده أيضًا.
CREATE OR REPLACE FUNCTION "order_discounts_redemption_limit"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  promo record;
  used_total bigint;
  used_by_customer bigint;
BEGIN
  SELECT max_redemptions, max_redemptions_per_customer INTO promo
    FROM "promotions" WHERE id = NEW.promotion_id FOR UPDATE;
  SELECT count(*), count(*) FILTER (WHERE d.customer_id = NEW.customer_id)
    INTO used_total, used_by_customer
    FROM "order_discounts" d JOIN "orders" o ON o.id = d.order_id
   WHERE d.promotion_id = NEW.promotion_id AND o.status NOT IN ('expired', 'cancelled');
  IF used_total >= promo.max_redemptions THEN
    RAISE EXCEPTION 'promotion_redemption_limit'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'promotion_redemption_limit';
  END IF;
  IF used_by_customer >= promo.max_redemptions_per_customer THEN
    RAISE EXCEPTION 'promotion_customer_limit'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'promotion_customer_limit';
  END IF;
  RETURN NEW;
END;
$$;
