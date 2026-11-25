# مخطط قاعدة البيانات

**المنفَّذ فعليًا:** الأندية (المرحلة 1)، والكتالوج (المرحلة 2)، وجداول البيع (المرحلة 3: الطلبات واللقطة والعروض والاشتراكات والاسترداد وطلبات التقييم والتدقيق). ما عداها في هذه الوثيقة **مخطط لما بعد المرحلة 3** ويُراجَع عند تنفيذه. المصدر المعتمد للمنفَّذ هو `packages/db/prisma/schema.prisma` وترحيلاته؛ وتصميم المرحلة 3 الكامل في `PHASE3_COMMERCE_DESIGN.md`.

**مفتاح التصنيف:** `[حقيقة]` · `[متطلب]` · `[توصية]` · `[افتراض]` · `[خارجي]` · `[لاحقًا]`.

## 1. قواعد عامة

- `[متطلب]` PostgreSQL. كل تغيير بنية بترحيل مُراجَع؛ لا تعديل يدوي على القاعدة.
- `[حقيقة]` المبالغ `INTEGER` (int4) بالهللة مع عمود عملة (`SAR`)، وكل حساب وسيط في SQL بـ`bigint`. لا `DECIMAL` ولا `FLOAT` للمال. (كان المخطط `BIGINT`؛ نسخه القرار 28.)
- `[متطلب]` الأوقات `timestamptz(3)` بتوقيت UTC، والتواريخ التقويمية (`starts_on`، `ends_on`) `date` بتوقيت النادي، والعرض بـ`Asia/Riyadh`.
- `[حقيقة]` عمود `club_id` في الجداول الرئيسية من اليوم الأول، بلا منطق تعدد منشآت. `[لاحقًا]` مسار الترخيص: قاعدة لكل منشأة كما في الـCRM.
- `[حقيقة]` المعرّفات `uuid(7)` يولّدها Prisma؛ والمرجع الظاهر للعميل `MSR-0001000` من تسلسل في القاعدة (البادئة تميّز المنصة عن الـCRM، سؤال 17 للمالك).
- `[حقيقة]` كل مفتاح أجنبي في جداول البيع `ON DELETE RESTRICT ON UPDATE RESTRICT`، عدا `promotion_products.promotion_id` (حذف متسلسل مع العرض).
- `[حقيقة]` UNIQUE والمفاتيح الأجنبية تُعلَن في `schema.prisma`؛ CHECK والدوال والتسلسل والـtriggers SQL في ملف الترحيل. اختبار تكامل يثبت أن `prisma migrate diff` بين الترحيلات والمخطط فارغ.
- `[حقيقة]` لا فهارس جزئية. لا حذف للسجلات المالية والتدقيقية (trigger يرفضه).

## 2. الكيانات بحسب السياق

| السياق     | الجداول                                                              | القاعدة الحاكمة                                                       | الحالة             |
| ---------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------ |
| المنشأة    | `clubs`                                                              | الهوية والمنطقة الزمنية والعملة والضريبة والسياسات المحسومة           | منفَّذ             |
| الكتالوج   | `products`, `product_versions`, `product_benefits`, `product_addons` | شروط النسخة لا تتغير أبدًا، ومزايا النسخة المباعة ثابتة               | منفَّذ             |
| العروض     | `promotions`, `promotion_products`                                   | العرض التلقائي والكوبون جدول واحد؛ الاستخدام هو سطر `order_discounts` | منفَّذ             |
| العملاء    | `customers`                                                          | الجوال فقط، بلا اسم                                                   | منفَّذ             |
| الطلبات    | `orders`, `order_items`, `order_discounts`                           | لقطة ثابتة للمنتج والسعر والضريبة والخصم، والتسوية على صف الطلب       | منفَّذ             |
| الاشتراكات | `memberships`                                                        | طلب مدفوع واحد = اشتراك واحد                                          | منفَّذ             |
| الاسترداد  | `refunds`                                                            | نموذج بيانات بلا كاتب حتى يُحسم الاسترداد                             | منفَّذ             |
| الحجوزات   | `assessment_requests`                                                | طلب تقييم ⇒ ليد في الـCRM                                             | منفَّذ             |
| الامتثال   | `audit_logs`                                                         | إلحاق فقط، بلا جوال ولا اسم                                           | منفَّذ             |
| المدفوعات  | `payment_attempts`, `payment_incidents`                              | التفعيل فقط بعد تحقق خادمي، والطلب لا يُنهى ومحاولته حيّة             | منفَّذ             |
| المدفوعات  | `payment_transactions`, `provider_events`                            | التحصيل المنفصل (4ب) وسجل الإشعارات                                   | مؤجَّل (القرار 49) |
| التجميد    | `membership_freezes`                                                 | عند حسم قواعد التجميد                                                 | `[لاحقًا]`         |
| الفواتير   | `invoices`                                                           | مرجع الفاتورة الصادرة من النظام المحاسبي                              | `[لاحقًا]`         |
| المحتوى    | `articles`, `article_recommendations`, `media`                       | التوصية تشير لمنتج، لا لسعر                                           | `[لاحقًا]`         |
| الهوية     | `staff`, `roles`, `permissions`                                      | الصلاحيات تُفحص على الخادم                                            | `[لاحقًا]`         |
| الامتثال   | `consents`, `attributions`                                           | إلحاق فقط                                                             | المرحلة 5          |
| التكامل    | `outbox_events`, `delivery_logs`                                     | تسليم أحداث الـCRM مع إعادة المحاولة                                  | المرحلة 5          |

`products.kind`: `membership` · `digital_program` · `assessed_service` (لا يُشترى مباشرة، ينشئ طلب تقييم) · `addon` (يُباع مع باقة مرتبطة به في `product_addons`).

## 3. العلاقات (ERD نصي)

```
clubs 1─* products 1─* product_versions 1─* product_benefits
products(membership) *─* products(addon)          عبر product_addons
clubs 1─* customers 1─* orders 1─* order_items *─1 product_versions
orders 1─0..2 order_discounts *─1 promotions *─* products   عبر promotion_products
orders 1─0..1 memberships 1─1 order_items(membership)
orders 1─* refunds            customers 1─* assessment_requests *─1 products(assessed_service)
audit_logs (append-only)      orders 1─* payment_attempts 1─* payment_incidents *─1 orders
```

## 4. القيود والـtriggers المنفَّذة (المرحلة 3)

الأسماء ثابتة بنمط `<table>_<rule>`، والاختبارات تطابقها حرفيًا. التفصيل في ترحيل `20261125090100_commerce`.

**UNIQUE**

| الجدول              | القيد                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| orders              | `idempotency_key`، `public_token`، `reference`، `(paid_provider, paid_provider_payment_id)` |
| orders (أهداف)      | `(id, customer_id)`، `(id, paid_at)`                                                        |
| order_items         | `(order_id, position)`، `(order_id, product_id)`، `(id, order_id, kind)`                    |
| order_discounts     | `(order_id, source)`، `(order_id, sequence)`، `(order_id, promotion_id)`                    |
| memberships         | `order_id` (طلب واحد = اشتراك واحد)، `order_item_id`                                        |
| customers           | `(club_id, phone_e164)`                                                                     |
| promotions          | `(club_id, code)`                                                                           |
| products (هدف)      | `(id, kind)`                                                                                |
| product_versions    | `(id, product_id, price_minor, currency, bonus_months)`، `(id, duration_months)` (أهداف)    |
| assessment_requests | `idempotency_key`                                                                           |
| refunds             | `(provider, provider_refund_id)`                                                            |

**المفاتيح الأجنبية المركّبة** (كلها مقبولة في Prisma 7.10، القرار 34)

| #   | المفتاح                                                                                                      | يمنع                            |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| FK1 | `order_items(product_version_id, product_id, list_price_minor, currency, bonus_months)` → `product_versions` | سطرًا يخالف سعر نسخته وعملتها   |
| FK2 | `order_items(product_version_id, duration_months)` → `product_versions(id, duration_months)` (MATCH SIMPLE)  | سطر اشتراك يخالف مدة نسخته      |
| FK3 | `order_items(product_id, kind)` → `products(id, kind)`                                                       | نوع سطر يخالف نوع منتجه         |
| FK4 | `order_discounts(order_id, customer_id)` → `orders(id, customer_id)`                                         | استخدامًا لغير عميل الطلب       |
| FK5 | `memberships(order_item_id, order_id, item_kind)` → `order_items(id, order_id, kind)`                        | اشتراكًا لسطر غير اشتراك        |
| FK6 | `memberships(order_id, order_paid_at)` → `orders(id, paid_at)`                                               | اشتراكًا لطلب غير مدفوع         |
| FK7 | `product_addons` و`assessment_requests` → `products(id, kind)` مع CHECK على عمود النوع                       | ربط منتج أو طلب تقييم بنوع خاطئ |

**CHECK** (أهمها)

- `orders`: الإجمالي موجب (`orders_total_positive`، لا طلب بإجمالي صفر)، و`total = subtotal - discount`، والضريبة بين 0 والإجمالي، والمهلة بعد الإنشاء؛ أعمدة التسوية الخمسة معًا أو لا شيء (`orders_payment_complete`)، والمبلغ والعملة المدفوعان يطابقان الطلب (`orders_payment_matches`)؛ اتساق الحالة مع `paid_at` و`expired_at` و`cancelled_at` و`fulfilled_at`؛ شكل المرجع والرمز والجوال وطول الاسم.
- `order_items`: الموضع 0..5 (سطر أساسي وخمس إضافات)، والخدمة بتقييم لا تدخل طلبًا، والموضع 0 وحده غير إضافة، والمدة وقاعدة البدء لسطر الاشتراك وحده، و`total = list - discount`، وضريبة السطر بصيغة النصف يُرفع `order_items_vat_formula`، والمزايا مصفوفة JSON.
- `promotions`: شكل الخصم (مئوي 1..10000 نقطة أو ثابت موجب بعملة)، ونافذة مرتبة، وحدود موجبة، وشكل الرمز `^[A-Z0-9]{3,32}$`.
- `order_discounts`: التسلسل 1 أو 2، ومبلغ موجب، والرمز للكوبون وحده.
- `memberships`: الفترة كاملة أو فارغة، و`ends_on = starts_on + make_interval(months => paid + bonus)` (`memberships_period_length`، يقصّ آخر الشهر)، والنشط والمجمّد والمنتهي لهم تاريخ بدء.
- `refunds`: مبلغ موجب، واتساق الحالة مع `decided_at` و`completed_at`.
- `clubs`: الضريبة 0..10000، والمهلة موجبة إن وُجدت.
- `audit_logs`: نوع الكيان والفاعل من قوائم مغلقة.

**دوال trigger** (رسائل الاستثناء نصوص ثابتة)

| #   | الدالة                               | الرسالة                                                                                                                | ما يفرضه                                                                                                  |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| T1  | `forbid_mutation()`                  | `order_snapshot_immutable`، `audit_log_append_only`، `assessment_request_immutable`، `*_delete_forbidden`              | لا تعديل ولا حذف للسطور والخصومات والتدقيق وطلبات التقييم؛ لا حذف للطلبات والاشتراكات والاسترداد والعملاء |
| T2  | `orders_guard_update()`              | `order_snapshot_immutable`، `order_payment_immutable`، `order_status_final`، `order_status_no_return`                  | اللقطة ثابتة، و`paid_*` تُكتب مرة، والنهائي نهائي، ولا عودة إلى `pending_payment`                         |
| T3  | `orders_assert_totals()` (مؤجَّل)    | `order_primary_item_required`، `order_addon_requires_membership`، `order_item_terms_mismatch`، `order_totals_mismatch` | عند COMMIT: سطر أساسي واحد، والإضافة مع اشتراك فقط، وعملة السطور ونسبتها، والمجاميع = السطور = الخصومات   |
| T4  | `order_discounts_redemption_limit()` | `promotion_redemption_limit` للحد الكلي، و`promotion_customer_limit` لحد العميل (`check_violation`، القرار 43)         | يقفل العرض ويعدّ الاستخدام النشط إجمالًا وللعميل                                                          |
| T5a | `product_versions_guard()`           | `product_version_terms_immutable`                                                                                      | شروط النسخة ثابتة؛ `valid_until` وحده يُعدَّل                                                             |
| T5b | `product_benefits_guard()`           | `product_version_benefits_frozen`                                                                                      | مزايا النسخة المباعة لا تُضاف ولا تُعدَّل ولا تُحذف                                                       |
| T6  | `memberships_guard()`                | `membership_snapshot_mismatch`، `membership_terms_immutable`، `membership_status_final`                                | الاشتراك يطابق لقطة سطره، والمراجع والأشهر والفترة ثابتة، والمنتهي والملغى نهائيان                        |
| T7  | `refunds_guard()`                    | `refund_requires_paid_order`، `refund_exceeds_order_total`، `refund_terms_immutable`، `refund_status_final`            | لطلب مدفوع فقط، والمجموع ≤ الإجمالي                                                                       |

**الفهارس:** `orders(status, expires_at)`، `orders(customer_id, created_at)`، `order_discounts(promotion_id, customer_id)`، `memberships(customer_id, status)`، `memberships(status, ends_on)`، `promotions(club_id, status, starts_at)`، `audit_logs(entity_type, entity_id, created_at)`، `assessment_requests(customer_id, created_at)`، `refunds(order_id)`.

**مؤجَّل:** قيد استبعاد يمنع تراكب اشتراكين للعميل (الامتداد `btree_gist` مثبَّت) حتى تُحسم قاعدة التجديد (القرار 35).

## 5. الثوابت

| الثابت                            | القيمة                                   | أين يُفرض                                       |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| أقصى مبلغ (`MAX_AMOUNT_MINOR`)    | 2,147,483,647 هللة (حد int4)             | المجال قبل القاعدة، والقاعدة ترفض ما فوقه       |
| الإضافات (`MAX_ADDONS_PER_ORDER`) | 5 لكل طلب                                | المجال، و`order_items_position_range`           |
| نسبة الضريبة                      | 0..10000 نقطة أساس، بلا افتراضي          | `clubs_vat_rate_range`، والطلب يختمها           |
| مرجع الطلب                        | `MSR-` + 7 أرقام، التسلسل 1000..9999999  | `order_reference_seq`، `orders_reference_shape` |
| رمز صفحة الطلب                    | 43 محرفًا (32 بايت base64url)            | `orders_public_token_length`                    |
| الجوال                            | `^\+9665[0-9]{8}$`                       | `customers`، `orders`، `assessment_requests`    |
| اسم المشتري                       | 2..120 محرفًا بعد التشذيب                | `orders`، `assessment_requests`                 |
| رمز الكوبون                       | `^[A-Z0-9]{3,32}$`                       | `promotions_code_shape`                         |
| خصومات الطلب                      | عرض تلقائي واحد وكوبون واحد (تسلسل 1، 2) | UNIQUE وCHECK على `order_discounts`             |

السياسات غير المحسومة أعمدة NULL في `clubs` تمنع إنشاء الطلب (القرار 32): `order_payment_window_minutes` و`membership_start_rule`. الترحيل يعبّئ `vat_rate_bps = 1500` مرة واحدة من الحقيقة الموثقة في `SECURITY.md`؛ ولا قيمة في الكود.

## 6. آلات الحالة

الحالة تتقدم فقط. جداول الانتقالات الكاملة في `packages/domain` وحدها (القرار 33)، والقاعدة تفرض الثوابت الخشنة فقط (T2، T6، T7، CHECK).

```
Order:      (create) → pending_payment → paid → fulfilled
                        ├→ expired      └→ refunded / partially_refunded   (محجوبان: refund_eligibility)
                        └→ cancelled    (بلا مستدعٍ في المرحلة 3)
            expired و cancelled و refunded نهائية؛ لا expired → paid (القرار 31)

Payment:    created → pending → authorized → captured → refunded (محجوب: refund_eligibility)
               │        ├→ failed   ├→ voided    └→ voided (عكس من المزوّد)
               └→ failed └→ expired
            «حيّة» = created أو pending أو authorized، أو captured ولم تُسجَّل تسويتها

Membership: scheduled → active ⇄ frozen     (التجميد محجوب: freeze_rules)
                          └→ expired (مشتق عند القراءة) / cancelled (محجوب)

Refund:     requested → approved → processing → completed
                        └→ rejected            └→ failed
```

- كل انتقال يُسجَّل في `audit_logs` بمن ومتى ولماذا.
- غير محسوم — قرار المالك: قواعد التجميد، الترقية، الإلغاء والاسترداد، تاريخ البدء، بدء التجديد.

## 7. حدود المعاملات

| العملية            | ما يدخل في معاملة واحدة                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| إنشاء طلب          | `customers` + `orders` + `order_items` (اللقطة) + `order_discounts` (الاستخدام) + `audit_logs` |
| تسجيل الدفع        | `orders → paid` + `memberships` + `orders → fulfilled` + `audit_logs`                          |
| إنهاء الطلبات      | قفل المستحق ثم `orders → expired` (بلا محاولة حيّة) + `audit_logs`: جملتان في معاملة واحدة     |
| بدء محاولة دفع     | قفل `orders` + `payment_attempts` (`created`) + `audit_logs`؛ استدعاء المزوّد بعدها خارجها     |
| تطبيق لقطة المزوّد | (1) `payment_attempts` + حوادثها، (2) معاملة `markOrderPaid`، (3) نتيجة التسوية وحادثة الرفض   |
| `[لاحقًا]` استرداد | `refunds` + تحديث الطلب + `outbox_events`                                                      |

- استدعاء المزوّد الخارجي **خارج** المعاملة؛ داخلها تُكتب النتيجة فقط.
- ترتيب الأقفال ثابت وموثق في `PHASE3_COMMERCE_DESIGN.md` («المعاملات والتزامن»).
- `[لاحقًا]` حدث الـCRM يُكتب في `outbox_events` داخل معاملة التفعيل (نمط outbox).

## 8. ما لا نخزّنه `[متطلب]`

- لا رقم بطاقة ولا CVV ولا أي بيانات بطاقة خام.
- لا بيانات صحية (تبقى في تطبيق المشترك في الـCRM).
- لا كلمات مرور للعملاء (الدخول برمز للجوال).
- لا اسم في `customers`: الاسم لقطة على الطلب وطلب التقييم فقط.

## 9. المنفَّذ حتى الآن

| الجدول                | المرحلة | الأعمدة الأساسية                                                                                                        | ملاحظات                                                |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `clubs`               | 1، 3    | الرمز، الاسم باللغتين، المنطقة الزمنية، العملة، `vat_rate_bps`، `order_payment_window_minutes`، `membership_start_rule` | العمودان الأخيران NULL = غير محسوم                     |
| `products`            | 2       | `club_id`، `kind`، `slug` (فريد)، الاسم والوصف باللغتين، `sort_order`، `status`                                         | الهوية الثابتة للمنتج                                  |
| `product_versions`    | 2، 3    | `price_minor` (هللة، شامل الضريبة)، `currency`، `duration_months`، `bonus_months`، `valid_from`، `valid_until`          | لا تداخل، وشروطها ثابتة (T5a)                          |
| `product_benefits`    | 2، 3    | `version_id`، النص باللغتين، `sort_order`                                                                               | ثابتة بعد أول بيع (T5b)                                |
| `product_addons`      | 3       | `membership_product_id`، `addon_product_id`، `sort_order`                                                               | بلا صف ربط لا تُعرض الإضافة                            |
| `customers`           | 3       | `club_id`، `phone_e164`                                                                                                 | لا اسم                                                 |
| `promotions`          | 3       | `code` (فارغ = تلقائي)، الاسم، `status`، شكل الخصم، `audience`، `scope`، `stackable`، النافذة، الحدان                   | `promotion_products` لنطاق المنتجات المحددة            |
| `orders`              | 3       | `reference`، `public_token`، `idempotency_key`، لقطة المشتري، المجاميع، `expires_at`، `paid_*`، أوقات الانتقال          | لقطة لا تتغير، والتسوية على الصف نفسه                  |
| `order_items`         | 3       | النوع والمنتج والنسخة، الاسم والوصف والمزايا، المدة، قاعدة البدء المختومة، السعر والخصم والإجمالي والضريبة              | إلحاق فقط                                              |
| `order_discounts`     | 3       | العرض والمصدر والرمز ولقطة القاعدة، `sequence`، `amount_minor`                                                          | هو سجل الاستخدام؛ نشط ما دام طلبه ليس منتهيًا ولا ملغى |
| `memberships`         | 3       | الطلب والسطر و`order_paid_at`، الأشهر، قاعدة البدء، `status`، `starts_on`، `ends_on` (حدّ غير مشمول)                    | `scheduled` بلا تواريخ حين لا يُحسم البدء              |
| `refunds`             | 3       | الطلب، المبلغ، الحالة، السبب، المزوّد، الأوقات                                                                          | لا كاتب له بعد                                         |
| `assessment_requests` | 3       | المنتج (خدمة بتقييم)، لقطة المشتري، مفتاح عدم التكرار وبصمته                                                            | إلحاق فقط                                              |
| `audit_logs`          | 3       | الكيان، الإجراء، الحالتان، الفاعل، `data`                                                                               | إلحاق فقط                                              |

«النسخة السارية» = أحدث نسخة `valid_from <= الآن` و(`valid_until` فارغ أو بعد الآن). منتج بلا نسخة سارية أو بلا مدة لا يُعرض.

التعريف الدقيق في `packages/db/prisma/schema.prisma` وترحيلاته؛ إن اختلف عن هذا الجدول فالملفات هي المرجع.
| `payment_attempts` | 4أ | الطلب والمزوّد والبيئة، لقطة المبلغ والعملة، `status`، معرّفا الجلسة والدفعة، `deadline_at`، `sync_lease_until`، `settled_at` و`settlement_result`، عدّاد الفحص وأوقات الانتقال | محاولة حيّة واحدة لكل طلب (T8) |
| `payment_incidents` | 4أ | الطلب والمحاولة، `kind` (11 نوعًا)، `data` بلا اسم ولا جوال، `opened_at`، أعمدة الحسم الثلاثة | إلحاق فقط، والحسم مرة (T10) |

## 10. قيود المدفوعات (المرحلة 4أ، ترحيل `20261125150000_payments`)

- **UNIQUE:** `payment_attempts(provider, provider_session_id)` و`(provider, provider_payment_id)`، و`payment_incidents(attempt_id, kind)`.
- **CHECK:** شكل المزوّد، البيئة `test`/`live`، مبلغ موجب، لا جلسة بلا معرّفها ولا تحصيل بلا معرّف دفعته، التسوية كاملة وبدفعة، سبب الفشل مع `failed` فقط، وقت النهاية مع الحالة النهائية فقط؛ ونوع الحادثة معروف وبياناتها كائن وحسمها كامل. و`audit_logs.entity_type` يقبل `payment_attempt`.
- **الدالة `payment_attempt_is_live(status, settled_at)`:** تعريف واحد للمحاولة الحيّة تستعمله الـtriggers واستعلامات الكود، ويطابق `isLiveAttempt` في المجال (اختبار تطابق شامل).

| الرمز | الدالة                                     | الرسائل الثابتة                                                                                                                                                                                                                          | ما يفرضه                                                                                                                        |
| ----- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| T8    | `payment_attempts_guard()`                 | `payment_attempt_initial_state`، `…_order_not_pending`، `…_snapshot_mismatch`، `…_deadline_after_expiry`، `…_live_exists`، `…_terms_immutable`، `…_reference_immutable`، `…_settlement_immutable`، `…_status_final`، `…_status_backward` | عند الإدراج يقفل الطلب ويطابقه ويمنع محاولة حيّة ثانية؛ بعده المراجع ثابتة ومعرّفا المزوّد والتسوية تُكتب مرة والحالة تتقدم فقط |
| T9    | `orders_forbid_expiry_with_live_attempt()` | `order_expiry_blocked_by_live_attempt`                                                                                                                                                                                                   | سدّ احتياطي للشرط الصلب 2 على `orders` عند الانتقال إلى `expired`                                                               |
| T10   | `payment_incidents_guard()`                | `payment_incident_reference_mismatch`، `…_append_only`، `…_resolution_final`                                                                                                                                                             | الحادثة تطابق طلبها ومحاولتها، ولا يُكتب بعدها إلا الحسم ومرة واحدة                                                             |

الحذف ممنوع من الجدولين (`payment_attempt_delete_forbidden`، `payment_incident_delete_forbidden`). الفهارس: `payment_attempts(order_id)` و`(status, deadline_at)`، و`payment_incidents(order_id)`.
