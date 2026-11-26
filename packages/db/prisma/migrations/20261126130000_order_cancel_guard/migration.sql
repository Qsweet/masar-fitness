-- المرحلة A2 (WP3): إلغاء طلب معلّق من اللوحة (docs/ADMIN_A2_SALES.md §6.4).

-- T11: سدّ احتياطي كـT9. الطلب لا يُكتب ملغى ما دامت له محاولة دفع حيّة، ولو نسي الكود الفحص: العميل
-- في صفحة المزوّد الآن، وإلغاء الطلب تحته يحوّل دفعته إلى مال بلا اشتراك. التعريف نفسه
-- payment_attempt_is_live، والدالة VOLATILE فاستعلامها يرى كل محاولة اعتُمدت قبله (T8 يأخذ قفل الطلب
-- نفسه عند بدء محاولة، فإحداهما تسبق والأخرى تُرفض).
CREATE FUNCTION "orders_forbid_cancel_with_live_attempt"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment_attempts" a
              WHERE a.order_id = NEW.id AND "payment_attempt_is_live"(a.status, a.settled_at)) THEN
    RAISE EXCEPTION 'order_cancel_blocked_by_live_attempt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_forbid_cancel_with_live_attempt" BEFORE UPDATE ON "orders"
  FOR EACH ROW WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION "orders_forbid_cancel_with_live_attempt"();
