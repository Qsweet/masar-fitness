# مخطط قاعدة البيانات

**تنبيه:** المنفَّذ فعليًا في المرحلة 1 هو جدول `clubs` فقط (لإثبات بنية الترحيلات والاتصال). كل ما عداه في هذه الوثيقة **مخطط للمرحلة 3 وما بعدها**، ويُراجَع عند تنفيذه. المصدر المعتمد للمنفَّذ هو `packages/db/prisma/schema.prisma` وترحيلاته.

**مفتاح التصنيف:** `[حقيقة]` · `[متطلب]` · `[توصية]` · `[افتراض]` · `[خارجي]` · `[لاحقًا]`.

## 1. قواعد عامة

- `[متطلب]` PostgreSQL. كل تغيير بنية بترحيل مُراجَع؛ لا تعديل يدوي على القاعدة.
- `[متطلب]` المبالغ `BIGINT` بالهللة مع عمود عملة (`SAR`). لا `DECIMAL` ولا `FLOAT` للمال.
- `[متطلب]` الأوقات `timestamptz` بتوقيت UTC، والعرض بـ`Asia/Riyadh`.
- `[توصية]` عمود `club_id` في الجداول الرئيسية من اليوم الأول، بلا منطق تعدد منشآت. `[لاحقًا]` مسار الترخيص: قاعدة لكل منشأة كما في الـCRM.
- `[توصية]` المعرّفات UUID؛ والمراجع الظاهرة للعميل والمزوّدين ببادئة تميّز المنصة عن الـCRM (انظر `PAYMENTS.md`).
- `[متطلب]` لا حذف للسجلات المالية والتدقيقية.

## 2. الكيانات بحسب السياق

| السياق     | الجداول                                                                  | القاعدة الحاكمة                                                   |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| المنشأة    | `clubs` (منفَّذ)                                                         | الهوية والمنطقة الزمنية والعملة                                   |
| الكتالوج   | `products`, `product_versions`, `product_benefits`, `addons`             | السعر والمدة في «نسخة» لا تُعدَّل بعد أول بيع؛ التغيير نسخة جديدة |
| العروض     | `promotions`, `coupons`, `coupon_redemptions`                            | الأهلية والتراكم قواعد مخزنة لا شيفرة                             |
| الطلبات    | `orders`, `order_items`                                                  | لقطة ثابتة للمنتج والسعر والضريبة والخصم                          |
| المدفوعات  | `payment_attempts`, `payment_transactions`, `provider_events`, `refunds` | التفعيل فقط بعد تحقق خادمي                                        |
| الاشتراكات | `memberships`, `membership_freezes`                                      | طلب مدفوع واحد = اشتراك واحد                                      |
| الحجوزات   | `assessment_requests`                                                    | طلب تقييم ⇒ ليد في الـCRM                                         |
| الفواتير   | `invoices`                                                               | مرجع الفاتورة الصادرة من النظام المحاسبي                          |
| المحتوى    | `articles`, `article_recommendations`, `media`                           | التوصية تشير لمنتج، لا لسعر                                       |
| الهوية     | `customers`, `staff`, `roles`, `permissions`                             | الصلاحيات تُفحص على الخادم                                        |
| الامتثال   | `consents`, `audit_logs`, `attributions`                                 | إلحاق فقط                                                         |
| التكامل    | `outbox_events`, `delivery_logs`                                         | تسليم أحداث الـCRM مع إعادة المحاولة                              |

`products.kind` يميّز الأنواع الثلاثة: `membership` · `digital_program` · `assessed_service` (الأخير لا يُشترى مباشرة).

## 3. العلاقات (ERD نصي)

```
clubs 1─* products 1─* product_versions 1─* product_benefits
customers 1─* orders 1─* order_items *─1 product_versions
orders 1─* payment_attempts 1─* payment_transactions
payment_attempts 1─* provider_events
orders 1─0..1 memberships 1─* membership_freezes
orders 1─* refunds            orders 1─0..1 invoices
promotions 1─* coupons 1─* coupon_redemptions *─1 orders
customers 1─* consents        orders 1─1 attributions
customers 1─* assessment_requests *─1 products
articles 1─* article_recommendations *─1 products
attributions *─0..1 articles
staff *─* roles *─* permissions
outbox_events 1─* delivery_logs       audit_logs (append-only)
```

## 4. القيود والفهارس

| القيد                                                                             | الغرض                             |
| --------------------------------------------------------------------------------- | --------------------------------- |
| `UNIQUE(memberships.order_id)`                                                    | تفعيل مرة واحدة لكل طلب           |
| `UNIQUE(provider, provider_event_id)` على `provider_events`                       | رفض الإشعار المكرر                |
| `UNIQUE(provider, provider_payment_id)` على `payment_attempts`                    | محاولة واحدة لكل دفعة عند المزوّد |
| `UNIQUE(orders.idempotency_key)`                                                  | منع الطلب المزدوج من ضغطتين       |
| `UNIQUE(orders.reference)`                                                        | مرجع واحد ظاهر لكل طلب            |
| `UNIQUE(coupons.code)` و`UNIQUE(coupon_id, customer_id)` عند حدّ الاستخدام الواحد | منع إعادة الاستخدام               |
| `UNIQUE(customers.phone_e164)`                                                    | عميل واحد لكل جوال                |
| `UNIQUE(articles.slug)`، `UNIQUE(products.slug)`                                  | روابط ثابتة                       |
| `CHECK (amount_minor >= 0)` على كل مبلغ                                           | لا مبالغ سالبة                    |
| `CHECK` على قيم الحالة المسموحة                                                   | لا حالة خارج الآلة                |
| مجموع الاستردادات ≤ المبلغ المحصَّل (يُفرض في المعاملة)                           | لا استرداد زائد                   |
| فهرس جزئي على `orders` حيث الحالة `pending_payment`                               | مهام المطابقة والانتهاء           |
| فهرس جزئي على `outbox_events` غير المسلَّمة                                       | عامل التسليم                      |
| فهرس `memberships(ends_at)` للنشطة                                                | تنبيهات الانتهاء                  |
| فهرس `orders(customer_id, created_at)`                                            | سجل العميل                        |
| مفاتيح أجنبية بـ`ON DELETE RESTRICT` على كل ما هو مالي                            | لا يتيم ولا حذف متسلسل            |

لقطة الشراء: `order_items` ينسخ الاسم والمدة والمزايا والسعر والضريبة والخصم وقت الشراء. تغيير الكتالوج لاحقًا لا يغيّر طلبًا قائمًا.

## 5. آلات الحالة

الحالة تتقدم فقط. حدث متأخر من المزوّد لا يعيد حالة سابقة.

```
Order:      draft → pending_payment → paid → fulfilled
                        ├→ expired      └→ refunded / partially_refunded
                        └→ cancelled

Payment:    created → pending → authorized → captured
                        ├→ failed   ├→ voided      └→ refunded
                        └→ expired

Membership: scheduled → active ⇄ frozen → expired
                          └→ cancelled   (بقرار إداري موثّق)

Refund:     requested → approved → processing → completed
                        └→ rejected            └→ failed
```

- الانتقالات المسموحة معرّفة في `packages/domain` كجداول صريحة، ومختبرة وحدةً وحدة.
- كل انتقال يُسجَّل في `audit_logs` بمن ومتى ولماذا.
- غير محسوم — قرار المالك: قواعد التجميد (المدة والعدد)، الترقية، الإلغاء والاسترداد، وتاريخ بدء `scheduled → active`.

## 6. حدود المعاملات

| العملية   | ما يدخل في معاملة واحدة                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| إنشاء طلب | `orders` + `order_items` (اللقطة) + `attributions` + حجز استخدام الكوبون                                    |
| تأكيد دفع | تحديث `payment_attempts` + `payment_transactions` + `orders → paid` + إنشاء `memberships` + `outbox_events` |
| استرداد   | `refunds` + تحديث الطلب + تعديل الاشتراك + `outbox_events`                                                  |
| تجميد     | `membership_freezes` + تمديد `ends_at` + `audit_logs`                                                       |

- استدعاء المزوّد الخارجي **خارج** المعاملة؛ داخلها تُكتب النتيجة فقط.
- تأكيد الدفع تحت قفل صف على الطلب (`SELECT … FOR UPDATE`) حتى لا يتسابق الإشعار ومهمة المطابقة.
- حدث الـCRM يُكتب في `outbox_events` داخل نفس معاملة التفعيل، ويُسلَّم بعدها (نمط outbox).

## 7. ما لا نخزّنه `[متطلب]`

- لا رقم بطاقة ولا CVV ولا أي بيانات بطاقة خام.
- لا بيانات صحية (تبقى في تطبيق المشترك في الـCRM).
- لا كلمات مرور للعملاء (الدخول برمز للجوال).

## 8. المنفَّذ في المرحلة 1

| الجدول  | الأعمدة                                                                                     | الغرض                                        |
| ------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `clubs` | المعرّف، الرمز، الاسم بالعربية والإنجليزية، المنطقة الزمنية، العملة، تاريخ الإنشاء والتحديث | إثبات مسار الترحيل والاتصال، وأساس `club_id` |

التعريف الدقيق في `packages/db/prisma/schema.prisma`؛ إن اختلف عن هذا الجدول فالملف هو المرجع.
