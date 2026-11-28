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
| المدفوعات  | `payment_transactions`, `provider_events`                            | التحصيل المنفصل (4ب) وسجل الإشعارات                                   | مؤجَّل (القرار 52) |
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

| الجدول                | المرحلة | الأعمدة الأساسية                                                                                                                     | ملاحظات                                                |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `clubs`               | 1، 3    | الرمز، الاسم باللغتين، المنطقة الزمنية، العملة، `vat_rate_bps`، `order_payment_window_minutes`، `membership_start_rule`              | العمودان الأخيران NULL = غير محسوم                     |
| `products`            | 2، A2   | `club_id`، `kind`، `slug` (فريد)، الاسم والوصف واسم الفئة (`tier_*`) باللغتين، `sort_order`، `status`                                | الهوية ثابتة بعد الإنشاء (P1)                          |
| `product_versions`    | 2، 3    | `price_minor` (هللة، شامل الضريبة)، `currency`، `duration_months`، `bonus_months`، `valid_from`، `valid_until`                       | لا تداخل، وشروطها ثابتة (T5a)                          |
| `product_benefits`    | 2، 3    | `version_id`، النص باللغتين، `sort_order`                                                                                            | ثابتة بعد أول بيع (T5b)                                |
| `product_addons`      | 3       | `membership_product_id`، `addon_product_id`، `sort_order`                                                                            | بلا صف ربط لا تُعرض الإضافة                            |
| `customers`           | 3       | `club_id`، `phone_e164`                                                                                                              | لا اسم                                                 |
| `promotions`          | 3، A2   | `code` (فارغ = تلقائي)، الاسم، `status` (ومنها `paused`)، شكل الخصم، `audience`، `scope`، `stackable`، النافذة، الحدان، `updated_at` | الرمز والنادي ثابتة (P2)؛ `promotion_products` للنطاق  |
| `orders`              | 3       | `reference`، `public_token`، `idempotency_key`، لقطة المشتري، المجاميع، `expires_at`، `paid_*`، أوقات الانتقال                       | لقطة لا تتغير، والتسوية على الصف نفسه                  |
| `order_items`         | 3       | النوع والمنتج والنسخة، الاسم والوصف والمزايا، المدة، قاعدة البدء المختومة، السعر والخصم والإجمالي والضريبة                           | إلحاق فقط                                              |
| `order_discounts`     | 3       | العرض والمصدر والرمز ولقطة القاعدة، `sequence`، `amount_minor`                                                                       | هو سجل الاستخدام؛ نشط ما دام طلبه ليس منتهيًا ولا ملغى |
| `memberships`         | 3       | الطلب والسطر و`order_paid_at`، الأشهر، قاعدة البدء، `status`، `starts_on`، `ends_on` (حدّ غير مشمول)                                 | `scheduled` بلا تواريخ حين لا يُحسم البدء              |
| `refunds`             | 3       | الطلب، المبلغ، الحالة، السبب، المزوّد، الأوقات                                                                                       | لا كاتب له بعد                                         |
| `assessment_requests` | 3       | المنتج (خدمة بتقييم)، لقطة المشتري، مفتاح عدم التكرار وبصمته                                                                         | إلحاق فقط                                              |
| `audit_logs`          | 3       | الكيان، الإجراء، الحالتان، الفاعل، `data`                                                                                            | إلحاق فقط                                              |

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

## 11. موظفو لوحة التحكم (المرحلة A1، ترحيل `20261126090000_staff_identity`)

| الجدول                 | المحتوى                                                                                                                                                                                                                                                                                 | ملاحظات                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `staff_users`          | `club_id`، `email` (فريد، صغير الحروف)، `display_name`، `role` (`owner/manager/editor/sales`)، `status` (`active/disabled`)، `password_hash` (scrypt)، `must_change_password`، `totp_secret_enc`، `totp_enabled_at`، `totp_last_step`، `failed_logins`، `locked_until`، `last_login_at` | لا يُحذف ولا ينتقل بين الأندية                 |
| `staff_sessions`       | `staff_user_id`، `token_hash` (SHA-256، فريد)، `created_at`، `last_seen_at`، `expires_at`، `mfa_verified_at`، `ip`، `user_agent` (255)، `revoked_at`                                                                                                                                    | سجل: لا يُحذف، والتدوير صف جديد                |
| `staff_recovery_codes` | `staff_user_id`، `code_hash` (SHA-256، فريد)، `used_at`                                                                                                                                                                                                                                 | كل رمز مرة؛ المجموعة تُستبدل عند إعادة التسجيل |

- **CHECK:** شكل البريد وصغر حروفه، طول الاسم، التجزئة بصيغة `scrypt$…`، العدّاد غير سالب، لا خطوة ثانية مفعّلة ولا خطوة مستعملة بلا سر؛ شكل تجزئة الرمز، الانتهاء بعد الإنشاء، طول العنوان والمتصفح.
- **`audit_logs`:** `entity_type` يقبل `staff_user`، و`actor` يقبل `staff:<uuid>` بجانب القيم القائمة، وفهرس جديد `(club_id, created_at)` لصفحة السجل.

| الرمز | الدالة                                | الرسائل الثابتة                                                                    | ما يفرضه                                                                                      |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| S1    | `staff_users_guard_last_owner()`      | `staff_last_owner_required`                                                        | آخر مالك نشط في النادي لا يُعطَّل ولا يُنزَّل؛ قفل استشاري لكل نادٍ يسلسل التغييرات المتزامنة |
| S2    | `staff_users_guard_identity()`        | `staff_user_identity_immutable`، `staff_user_delete_forbidden`                     | النادي وتاريخ الإنشاء ثابتان، والحذف ممنوع                                                    |
| S3    | `staff_sessions_guard_update()`       | `staff_session_immutable`، `staff_session_final`، `staff_session_delete_forbidden` | يتغير آخر نشاط فقط؛ الإلغاء وإثبات الخطوة الثانية يُكتبان مرة ولا يُمحيان                     |
| S4    | `staff_recovery_codes_guard_update()` | `staff_recovery_code_used_once`                                                    | `used_at` يُكتب مرة، والرمز وصاحبه ثابتان                                                     |

**المعاملات:** عدّ المحاولة الفاشلة تحت قفل صف الموظف؛ تغيير الدور والحالة تحت قفل مالكي النادي ثم صف الموظف، ومعه إلغاء الجلسات وسطر التدقيق؛ قبول خطوة TOTP تحديث ذرّي يشترط أنها أحدث من آخر خطوة مقبولة؛ استهلاك رمز الاسترجاع `UPDATE … WHERE used_at IS NULL`.

## 12. إدارة المبيعات من اللوحة (المرحلة A2، الحزم WP1–WP4)

أربعة ترحيلات صغيرة، كلٌّ مع حزمته (`ADMIN_A2_SALES.md` §3). لا تغيير في T1–T10 ولا S1–S4.

| الترحيل                                       | الحزمة       | المحتوى                                                                                                                                       |
| --------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261126120000_sales_admin_base`             | WP1          | فهرس `orders(club_id, created_at)` لقائمة الطلبات. `audit_logs.entity_type` يقبل `product`، `promotion`، `customer`، `club`، `manual_payment` |
| `20261126130000_order_cancel_guard`           | WP3          | T11                                                                                                                                           |
| `20261126140000_manual_payments`              | WP4          | جدول `manual_payments` وT12 وT13                                                                                                              |
| `20261126150000_manual_payment_reference_key` | WP4 (مراجعة) | عمود `reference_key` وفهرسه الفريد لكل نادٍ، بدل الفرادة على النص ولكل طريقة (القرار 67)                                                      |

**`manual_payments`** (إلحاق فقط): `id` (يولَّد عند رسم نموذج التأكيد، وهو `orders.paid_provider_payment_id`)، `club_id`، `order_id`، `method`، `external_reference` (كما كتبه الموظف، للعرض)، `reference_key` (مفتاح الفرادة الموحَّد من `manualReferenceKey`: حروف وأرقام فقط)، `received_on` (DATE بتقويم النادي)، `amount_minor`، `currency`، `note` (نص حر لا يدخل التدقيق)، `recorded_by` (FK إلى `staff_users`)، `created_at`.

- **UNIQUE:** `manual_payments(order_id)` (دفعة يدوية واحدة للطلب)، و`(club_id, reference_key)` (المرجع لا يسوّي طلبين في النادي، بأي طريقة وبأي كتابة).
- **CHECK:** الطريقة `bank_transfer` أو `paid_at_club`؛ المرجع مشذَّب وطوله 3 إلى 64؛ المبلغ موجب؛ شكل العملة؛ الملاحظة مشذَّبة وطولها 1 إلى 500 أو NULL؛ `reference_key` حروف كبيرة وأرقام بلا فراغ ولا ترقيم، وطوله 3 على الأقل.
- **فحص التطبيق (المجال):** `received_on` ليس بعد اليوم ولا قبل يوم إنشاء الطلب بتقويم النادي (`validateManualPayment`)؛ والطلب الذي بلغ مهلته لا يُدفع ولو لم يُكتب منتهيًا (`decideManualSettlement`). القاعدة لا تقرأ الساعة: `now` يُمرَّر من الكود.

| الرمز | الدالة                                                                | الرسائل الثابتة                                                                                                    | ما يفرضه                                                                                                                                                  |
| ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T11   | `orders_forbid_cancel_with_live_attempt()`                            | `order_cancel_blocked_by_live_attempt`                                                                             | سدّ احتياطي كـT9: الطلب لا يُكتب `cancelled` وله محاولة دفع حيّة (`payment_attempt_is_live`)                                                              |
| T12   | `manual_payments_guard()`                                             | `manual_payment_order_not_pending`، `…_snapshot_mismatch`، `…_blocked_by_live_attempt`، `manual_payment_immutable` | عند الإدراج يقفل الطلب ويطابقه (معلّق، والنادي والمبلغ والعملة لقطته، وبلا محاولة حيّة)؛ التعديل والحذف ممنوعان                                           |
| T13   | `manual_payment_settlement_link()` و`orders_require_manual_payment()` | `manual_payment_requires_settlement`، `order_manual_payment_missing`                                               | مؤجَّل عند COMMIT: كل صف يدوي طلبه يحمل `paid_provider = 'manual'` ومعرّفه؛ وعند `UPDATE orders`: لا تسوية «manual» بلا صف مطابق بالمعرّف والمبلغ والعملة |

**المعاملات:** `cancelPendingOrder` و`recordManualPayment` تقفلان الطلب `FOR UPDATE` أولًا (القفل نفسه الذي يأخذه T8 و`markOrderPaid`)، ثم تقرآن المحاولة الحيّة، ثم القرار في المجال. الدفع اليدوي يدرج صفه ثم يستدعي `settleInTransaction` نفسها (ترتيب الأقفال: الطلب ثم العميل)، وأي رفض من التسوية يتراجع عن كل شيء. كشف الجوال يقرأ الرقم ويكتب سطر تدقيقه في معاملة واحدة.

**ما لا يخرج من `packages/db`:** الجوال الكامل، إلا من `revealCustomerPhone` بسطر تدقيق. القوائم والتفصيل وصفحة العميل تحمل `maskSaudiMobile` (آخر أربعة أرقام).

## 13. إدارة الكتالوج والعروض وإعدادات البيع (المرحلة A2، الحزم WP5–WP10)

ثلاثة ترحيلات (`ADMIN_A2_SALES.md` §3). لا تغيير في T1–T13 ولا S1–S4؛ يُضاف P1 وP2. لا جدول جديد: التدقيق في `audit_logs` القائم (`entity_type` يقبل `product` و`promotion` و`club` منذ WP1)، وإعدادات البيع عمودا `clubs` القائمان.

| الترحيل                                  | الحزمة | المحتوى                                                                                                                                                                            |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261127090000_catalog_admin`           | WP6    | `products.tier_ar` و`tier_en` (`text NULL`؛ CHECK: معًا أو لا شيء، وطول 1..60 بعد التشذيب)، ونقل القيم الثلاث من قاموس الموقع إلى صفوفها بالمعرّف النصي. **P1** `products_guard()` |
| `20261127090100_promotion_status_paused` | WP9    | `ALTER TYPE promotion_status ADD VALUE 'paused' BEFORE 'archived'` منفردًا (القيمة لا تُستعمل في معاملة إضافتها)                                                                   |
| `20261127090200_promotions_admin`        | WP9    | `promotions.updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` (رمز القفل المتفائل). **P2** `promotions_guard()`                                                        |

| الرمز | الدالة               | الرسالة الثابتة                | ما يفرضه                                                                                                                                             |
| ----- | -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1    | `products_guard()`   | `product_identity_immutable`   | `BEFORE UPDATE ON products`: `id` و`club_id` و`kind` و`slug` و`created_at` لا تتغير (الرابط العام وسلة العميل يحملان `slug`)                         |
| P2    | `promotions_guard()` | `promotion_identity_immutable` | `BEFORE UPDATE ON promotions`: `id` و`club_id` و`code` و`created_at` لا تتغير (الرمز مختوم في `order_discounts.code`، وفريد لكل نادٍ على كل الحالات) |

- **`paused`:** لا شيء في التسعير يقرؤه؛ `checkPromotion` و`loadCandidateIds` يقبلان `active` وحده، فالإيقاف يسري على أول طلب تالٍ، والطلب المعلّق يبقى بلقطته.
- **النسخ السعرية:** تغيير السعر أو المدة أو المجاني يغلق السارية (`valid_until = الآن`، الكتابة الوحيدة المسموحة بـT5a) ويدرج نسخة من اللحظة نفسها. مزايا نسخة غير مباعة تُستبدل في مكانها؛ المباعة ⇒ نسخة جديدة (T5b سدّها). فحص نصي (`version-terms-immutable.test.ts`) يثبت ذلك على كود الإنتاج.
- **المعاملات:** كل كتابة `inTransaction` مع سطر تدقيقها بفاعل `staff:<id>`. المنتج `FOR UPDATE` ثم نسخته؛ العرض `FOR UPDATE` (القفل نفسه الذي يأخذه `lockPromotions` وT4، فخفض الحد يتسلسل مع الطلبات)؛ حارس آخر باقة تحت `pg_advisory_xact_lock` لكل نادٍ. القفل المتفائل بـ`updated_at` (المنتج، العرض، النادي)، والكتابة الخام ترفعه صراحةً.
- **لا حذف:** لا منتج ولا نسخة ولا عرض يُحذف من أي كود (الفحص النصي نفسه)؛ البديل الأرشفة والإنهاء.

## 14. إدارة المحتوى (المرحلة A3، الحزم WP1–WP5)

ترحيلان من الأربعة في `ADMIN_A3_CONTENT.md` §10 (الآخران مع مكتبة الصور WP9)، وثالث بعد المراجعة يمنع TRUNCATE. القواميس وثوابت `config/` تبقى مصدر الافتراضي؛ القاعدة تحفظ التجاوزات وحدها.

| الترحيل                           | الحزمة | المحتوى                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261128090000_content_releases` | WP2    | `content_releases` (`id`، `club_id`، `seq`، `snapshot jsonb`، `schema_version`، `digest char(64)`، `source`، `changed_count`، `rolled_back_from` FK ذاتي، `published_by`، `published_at`) بفهرس `UNIQUE(club_id, seq)`. CHECK: الرقم موجب، المخطط 1، البصمة ست عشرية، المصدر `publish`/`rollback` والاسترجاع وحده يشير إلى إصدار، اللقطة كائن. **C1**. توسيع `audit_logs_entity_type_known` بـ`content_release` و`content_draft` و`media_asset` |
| `20261128090100_content_drafts`   | WP3    | `content_draft_entries` بمفتاح `(club_id, entry_key, locale)`، و`value jsonb NULL` (`{value, baseHash}` أو NULL «عودة إلى الافتراضي»)، و`updated_by`، و`updated_at` (رمز القفل المتفائل). CHECK: المفتاح `text:<مسار>` بشكل المجال، اللغة `ar`/`en`، والقيمة نص 1..700 وبصمة SHA-256                                                                                                                                                            |

| الرمز | الدالة                                  | الرسالة الثابتة             | ما يفرضه                                                                                                                                             |
| ----- | --------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1    | `forbid_mutation(...)` (القائمة منذ T1) | `content_release_immutable` | `content_releases` إلحاق فقط: لا UPDATE ولا DELETE ولو خامًا، ولا TRUNCATE (محفّز جملة، ترحيل `20261128090200_content_releases_truncate`، القرار 73) |

- **القراءة العامة:** `SELECT id, seq, digest … WHERE club_id = $1 ORDER BY seq DESC LIMIT 1` بفحص فهرس عكسي على `content_releases_club_id_seq_key` (مثبت بـ`EXPLAIN`). اللقطة تُقرأ مرة لكل إصدار وتبقى في ذاكرة العملية (C1 يجعل الإبطال غير لازم).
- **المعاملات:** كتابة المسودة والنشر والاسترجاع والتجاهل كلها `inTransaction` تحت `pg_advisory_xact_lock` لمفتاح `content:<club_id>` (`lockContent`)، ومعها سطر تدقيقها بفاعل `staff:<id>`: `content_draft_saved` و`content_published` و`content_rolled_back` و`content_draft_discarded`. `data` قيم بسيطة (المساحة، العدد، الرقم، البصمة)؛ المسار لا يكون مفتاحًا أبدًا.
- **الرقم:** `max + 1` تحت القفل، و`UNIQUE(club_id, seq)` سدّه الاحتياطي؛ نشران متزامنان ⇒ واحد، والآخر `content.draft_changed`.
- **المسودة نسخة عمل لا سجل:** الاسترجاع والتجاهل يحذفان صفوفها ويكتبان صفوف اللقطة برموز أحدث من كل ما سبق.
- `resetCommerceTables` يفرّغ الجدولين (قاعدة اختبار فقط، ويعطّل محفّز TRUNCATE لحظته).
- **«المسودة متغيرة»** فرق في النص المعروض بين المنشور والمسودة بالسجل الحالي (`isDraftDirty`)، لا مقارنة ببصمة الإصدار المحفوظة (القرار 73).

## 15. شريط الشرائح ومكتبة الوسائط (`ADMIN_A3_SLIDER.md`، ترحيل `20261129090000_slider_media`)

ترحيل بأربعة جداول، وترحيل ثانٍ بعد المراجعة يشدّد شكل الرابط. الشريط في المسودة جدولان يلتقطهما النشر في لقطة الإصدار نفسها (`snapshot.slider`، القرار 74)؛ المكتبة جدول، والربط بين الإصدار وأصوله جدول للإلحاق فقط.

| الجدول                    | المحتوى                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `media_assets`            | `id`، `club_id`، `sha256 char(64)` (`UNIQUE(club_id, sha256)`)، `width`، `height` (بعد التدوير)، `bytes`، `variant_widths int[]`، `blur_data_url`، `dominant_color char(7)`، `original_name`، `created_by`، `created_at`. CHECK: البصمة ست عشرية، الضلع 1..8000، الحجم 1..8 MiB، العروض 1..8 بلا NULL، الضباب `data:image/webp;base64,` حتى 2048، اللون `#rrggbb`، الاسم 1..120. **C2**                                                                                                                                                                                          |
| `content_slides`          | المسودة: `id`، `club_id`، `position` (0..7، كثيف يُعاد كتابته تحت القفل)، `desktop_asset_id` و`mobile_asset_id NULL` (FK RESTRICT)، `decorative`، `alt_ar/en`، `eyebrow/title/subtitle/cta_ar/en`، `link_kind`، `link_target`، `link_new_tab`، `click_target`، `active`، `starts_at`/`ends_at NULL`، `created_*`، `updated_by`، `updated_at` (رمز القفل المتفائل). CHECK: النوعان معروفان، شكل الرابط بنوعه (لا شيء فارغ، الداخلي `/` لا `//`، الخارجي `https://` حتى 500)، بلا رابط لا زر، النص البديل باللغتين أو زخرفية بلا نص، الأطوال 40/70/160/30/250، النهاية بعد البداية |
| `content_slider_settings` | المسودة: `club_id` PK، `autoplay`، `interval_ms` (CHECK 4000..15000)، `updated_by`، `updated_at`. غياب الصف = الافتراضي                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `content_release_media`   | `(release_id, asset_id)` PK، وFK RESTRICT للطرفين، وفهرس `asset_id`. **C3**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

| الرمز | الدالة                 | الرسالة الثابتة                   | ما يفرضه                                                                                                        |
| ----- | ---------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| C2    | `forbid_mutation(...)` | `media_asset_immutable`           | لا UPDATE على `media_assets`: ملفات الأصل تحت بصمته ووصفه في اللقطات لا يتغيران. الحذف تمنعه FK ما دام مستعملًا |
| C3    | `forbid_mutation(...)` | `content_release_media_immutable` | `content_release_media` للإلحاق فقط: لا UPDATE ولا DELETE ولا TRUNCATE (محفّز صف ومحفّز جملة)                   |

- **منع حذف صورة مستعملة بثلاثة سدود:** المستودع يفحص الاستعمال تحت قفل المحتوى ويرفض بـ`media.in_use`، وFK من `content_slides` (المسودة)، وFK من `content_release_media` (كل إصدار دخلته). فالاسترجاع إلى أي إصدار يجد صوره.
- **المعاملات:** إنشاء الشريحة وتعديلها وتحريكها وإزالتها والإعدادات وحذف الصورة كلها تحت `lockContent` مع سطر تدقيقها (`content_slide_*`، `content_slider_settings_saved`، `media_asset_uploaded`، `media_asset_deleted`)؛ النشر يقرأ الشريط ويكتب `content_release_media` في معاملته، والاسترجاع والتجاهل يستبدلان صفوف المسودة بشريط اللقطة (المعرّفات نفسها، ورموز أحدث من كل ما سبق).
- **ترحيل `20261130090000_slide_link_shape`** (القرار 77): `content_slides_link_shape` يُسقط ويُعاد بمسار داخلي صارم `^/[a-z0-9/_#-]*$` بلا `//`، ورابط خارجي بلا `\` ولا مسافة.
- **الخدمة العامة** لا تسأل القاعدة لكل صورة: صور الشرائح السارية من لقطة آخر إصدار في ذاكرة القارئ. `content_release_media` يبقى سدّ الحذف.
- **القائمة:** صفحات واستعمال كل صورة بمصفوفتين في الاستعلام نفسه (`ARRAY(SELECT …)`)، لا استعلام لكل صورة.
- `audit_logs_entity_type_known` يُوسَّع بـ`content_slide`؛ و`resetCommerceTables` يفرّغ الجداول الأربعة (قاعدة اختبار فقط، ويعطّل محفّز TRUNCATE لحظته).
- **النسخ الاحتياطي:** الجداول الأربعة في نسخة القاعدة، وملفات `MEDIA_DIR` (وحدة `media-data`) معها؛ الصف بلا ملفاته يُخدَّم 404، والملفات بلا صف لا تُخدَّم لأحد.

## لوحة التحكم v2: «نظرة عامة» لفترة (القرار 86)

| الترحيل                                    | المحتوى                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261201090000_orders_club_paid_at_index` | فهرس `orders(club_id, paid_at)`: الإيراد والطلبات المدفوعة بيوم الدفع لنادٍ في فترة. الإنشاء في الفترة على `orders(club_id, created_at)` القائم |

القراءات في `packages/db/src/staff/overview-period.ts` (`periodDailySeries`، `periodSalesByPlan`، `periodFunnel`، `clubHasOrders`): كلٌّ محصور بنادٍ ومدى لحظتين يحسبهما المجال بتقويم النادي (≤ 366 يومًا)، بلا `NOW()`. القمع يقرأ `payment_attempts` بفهرسها القائم على `order_id`. لا جدول جديد، فلا تغيير في قوائم جداول النسخ.

## 16. الربط والقياس (المرحلة A5، ترحيل `20261202090000_tracking`، القرار 88)

المواصفة `ADMIN_A5_TRACKING.md` §4–§7.

| الجدول                  | الأعمدة الأساسية                                                                                                                                                                                                                                                   | القيود                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tracking_integrations` | `club_id`، `provider`، `enabled`، `config` (المعرّفات العامة JSONB)، `secret_enc`، `secret_last4`، `test_event_code`، `updated_at`، `updated_by`                                                                                                                   | PK `(club_id, provider)`؛ `provider` من الثماني (`x` بالقرار 90، `openai` بالقرار 93)؛ `config` كائن؛ المفتاح بصيغة `sealSecret` (‏`v1.<iv>.<tag>.<نص>`) ومعه آخر أربعة أو بدونهما معًا؛ رمز الاختبار `^[A-Za-z0-9_-]{4,40}$`                                         |
| `order_tracking`        | `order_id` (PK، FK)، `club_id`، `consent_analytics`، `consent_ads`، `consent_version`، `consent_at`، `first_touch`، `last_touch`، `ga_client_id`، `fbp`، `fbc`، `scid`، `ttp`، `obref`، `oppref`، `client_ip`، `user_agent`، `page_url`، `created_at`، `purged_at` | للإدراج فقط إلا التفريغ (`order_tracking_guard_update`)؛ اللمستان كائنان؛ حدود طول لكل معرّف                                                                                                                                                                          |
| `tracking_outbox`       | `id`، `club_id`، `order_id` (للحي)، `provider`، `event_name`، `event_id`، `kind` (`live`/`test`)، `status` (`pending`/`sent`/`dead`/`skipped`)، `attempts`، `next_attempt_at`، `last_status`، `last_reason`، `event_time`، `created_at`، `updated_at`، `sent_at`   | المنصة من الخمس الخادمية (`openai` بالقرار 93)؛ الحي له طلب والاختبار بلا طلب؛ السبب رمز `^[a-z0-9_]{1,64}$`؛ **فريد جزئي** `(club_id, provider, event_name, event_id) WHERE kind = 'live'`؛ فهارس `(status, next_attempt_at)` و`(club_id, created_at)` و`(order_id)` |

- **الإدراج في التسوية:** `enqueuePurchaseConversions` (‏`packages/db/src/tracking/enqueue.ts`) جملة `INSERT … SELECT … ON CONFLICT DO NOTHING` واحدة في `settleInTransaction` بعد `recordPayment`، لا في الإعادة ولا في الرفض. شرطها: منصة مفعّلة لها مفتاح، وموافقة فئتها على الطلب (`ga4` بالتحليلات، والبقية بالإعلانات).
- **لا حمولة ولا جسم رد** في `tracking_outbox`: الحمولة تُبنى عند الإرسال من الطلب و`order_tracking`.
- **التدقيق** يقبل `tracking_integration` (الكيان = النادي)، والسطر بلا قيمة مفتاح ولا آخر أربعة (`platform`، `changed`، `testEventCodeChanged`، `secretChanged`).
- **الاحتفاظ (القرار 90-6):** `order_tracking` يحمل عنوان IP ووكيل المتصفح ومعرّفات النقر وكوكيات المنصات بموافقة الإعلانات؛ تُفرَّغ بعد 90 يومًا من إنشاء الطلب (`tracking:purge`، `ADMIN_A5_TRACKING.md` §7.1).
- **النسخ الاحتياطي:** نسخة القاعدة كاملة (`pg_dump`)، فالجداول الثلاثة فيها بلا قائمة تُحدَّث؛ المفاتيح فيها مشفّرة، ومفتاح فكها `ADMIN_SECRET_KEY` لا يدخل النسخ.

**تصحيحات المراجعة (القرار 89، ترحيل `20261203090000_tracking_claims`):** عمود `tracking_outbox.claim_token` (UUID، يُكتب مع كل حجز ويُفك مع تسجيل النتيجة، و`recordAttempt` يشترطه)، وجدول `tracking_browser_purchases` (`order_id` PK وFK، `created_at`): أول عرض لصفحة الطلب المدفوع حمل الجوال المجزّأ إلى المتصفح، مرة لكل طلب.

**أجوبة المالك (القرار 90):**

- ترحيل `20261204090000_tracking_x`: قيد `tracking_integrations_provider_known` يقبل `x`. `tracking_outbox_provider_server` باقٍ على الأربع (X في المتصفح وحده).
- `config` يقبل `sendHashedPhone` منطقيًّا («إرسال الجوال المجزّأ»، الغائب مفعَّل)، ولـX: `pixelId` و`purchaseEventId` و`addToCartEventId` و`leadEventId`. التحقق في المجال (`parseIntegrationConfig`)، والقاعدة تفحص أن `config` كائن.
- ترحيل `20261204090100_tracking_retention`: عمود `order_tracking.purged_at` (TIMESTAMPTZ، null ما لم يُفرَّغ)؛ دالة `tracking_scrub_touch(jsonb)` تبقي من اللمسة `at` و`landing` و`values` بمفاتيح `utm_*` وحدها؛ trigger `order_tracking_guard_update` بدل `order_tracking_forbid_update` يرفض كل تحديث (`order_tracking_immutable`) إلا التفريغ: أول `purged_at`، وكل معرّف null، واللمستان بالدالة، وبقية الأعمدة كما هي؛ فهرس جزئي `order_tracking_unpurged_idx (created_at) WHERE purged_at IS NULL`.
- `tracking_outbox.last_reason` قد يكون `retention_purged` لسطر معلّق أُغلق بالتفريغ.

**إعلانات ChatGPT (OpenAI، القرار 93، ترحيل `20261205090000_tracking_openai`):**

- `tracking_integrations_provider_known` يقبل `openai` (ثماني منصات)، و`tracking_outbox_provider_server` يقبله (خمس خادمية: `ga4` و`meta` و`snap` و`tiktok` و`openai`)، و`enqueuePurchaseConversions` يدرجه بموافقة الإعلانات.
- عمود `order_tracking.obref` (TEXT، null بلا موافقة الإعلانات): مرجع المتصفح من كوكي البكسل `__obref`، حده 200 محرف (`order_tracking_obref_length`)، ويُرسل في `user.obref`.
- `order_tracking_guard_update` (‏`CREATE OR REPLACE`) يضيف `obref` إلى المعرّفات التي يشترط التفريغ تصفيرها، و`purgeExpiredTracking` يصفّره. `oppref` داخل اللمستين فتُسقطه `tracking_scrub_touch` كبقية معرّفات النقر.
- ترحيل `20261206090000_tracking_oppref` (مراجعة القرار 93): عمود `order_tracking.oppref` (كوكي `__oppref` بموافقة الإعلانات)، وقيد `order_tracking_oppref_shape` (1–512 محرفًا بلا محارف تحكم)، والـtrigger يضيفه إلى المعرّفات، والتفريغ يصفّره.
- `config` لـOpenAI: `pixelId` (‏`^[A-Za-z0-9_-]{6,64}$`) و`sendHashedPhone` و`aamDisabled` (تأكيد إطفاء المطابقة المتقدمة الآلية، شرط التفعيل)؛ المفتاح في `secret_enc` كبقية المنصات الخادمية.
