-- المرحلة A2 (WP9): حالة عرض جديدة «متوقف مؤقتًا»، تميّز ما أوقفه الموظف عن المسودة التي لم تُفعَّل قط.
-- منفردة في ترحيلها (سابقة 20261125090000_product_kind_addon): قيمة enum الجديدة لا تُستعمل في
-- المعاملة التي أُضيفت فيها. لا شيء في التسعير يقرؤها: `checkPromotion` يرفض كل ما ليس active.
ALTER TYPE "promotion_status" ADD VALUE 'paused' BEFORE 'archived';
