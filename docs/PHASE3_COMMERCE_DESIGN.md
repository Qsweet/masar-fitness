# تصميم المرحلة 3: محرك بيع الاشتراكات (بلا دفع حي)

الحالة: **تصميم معتمد من لجنة داخلية، ومنفَّذ (2026-11-25).** التنفيذ في الحزم الثماني، وما خالف التصميم مسجَّل في `DECISIONS.md` (34، 37–45) ودليل التحقق في `PROGRESS.md`. ملفات الواجهة المذكورة هنا (`plan-paths.ts`، `plan-summary.tsx`، `plan-shop.tsx`) استُبدلت بالتصميم المعتمد: `plan-view.ts` و`configurator.tsx` و`plans-section.tsx`.
**كيف أُعدّ:** ثلاثة مصممين مستقلين بأولويات مختلفة (سلامة البيانات، نقاء المجال، البساطة)، ثم حكمان (مهندس مدفوعات وقائد تقني) هاجما المقترحات بسيناريوهات تزامن وأعطال، ثم توليف أصلح كل خلل قاتل وجداه.

# المرحلة 3 — محرك بيع الاشتراكات بلا دفع حي (التصميم النهائي)

## الملخص

الأساس مقترح «السلامة» (integrity)، لأن المحكّمَين وجداه الوحيد الذي لا يكسر فيه أي تداخل زمني قيدًا صلبًا. أُصلح كل ما عُدّ فيه خللًا قاتلًا أو خطرًا، وأُخذ من المقترحين الآخرين ما ثبت أنه أفضل. القرارات الحاكمة:

1. **المال INTEGER (int4) بالهللة** في كل عمود، وكل حساب وسيط بـBigInt أو bigint. قاعدة تقريب واحدة هي النصف يُرفع، وتطبَّق في موضعين فقط: الخصم المئوي، وضريبة كل سطر. توزيع الخصم على السطور بالباقي الأكبر.
2. **الطلب لقطة لا تتغير.** سطوره وخصوماته للإدراج فقط. مجاميع الرأس تُفحص عند COMMIT. السعر والمدة في اللقطة لا يخالفان النسخة المباعة.
3. **التسوية أعمدة على صف الطلب نفسه.** قيد CHECK يطابق المبلغ والعملة، وقيد UNIQUE على معرّف دفعة المزوّد. **الاشتراك لا يوجد إلا لطلب مدفوع، ومرة واحدة**: مفتاح مركّب إلى `orders(id, paid_at)` مع `UNIQUE(order_id)`.
4. **استخدام الكوبون هو سطر `order_discounts` نفسه**، فلا عدّاد يمكن أن ينحرف. الحد يُعاد عدّه تحت قفل صف العرض داخل trigger. الحالتان `expired` و`cancelled` نهائيتان، فالدفعة المتأخرة **لا تُحيي** طلبًا منتهيًا ولا تتجاوز حد كوبون.
5. **كل سياسة لم يحسمها المالك تمنع العملية ولا تفترض قيمة.** صورها: عمود NULL في `clubs` يمنع إنشاء الطلب، أو انتقال في جدول الحالات معلَّم `blockedBy` بلا مستدعٍ، أو غياب كامل لما لا يلزم.
6. **المنطق كله دوال خالصة في `packages/domain`.** الدالة `buildOrderDraft` هي الوحيدة التي تقرر ما يُكتب، وطبقة القاعدة تجمع الحقائق تحت الأقفال وتكتب الناتج حرفيًا (من مقترح «النقاء»). جداول الانتقالات تُعرَّف مرة واحدة في المجال. في القاعدة لا تُفرض إلا الثوابت الخشنة: الحالة النهائية تبقى نهائية، ولا عودة إلى `pending_payment`، وأعمدة `paid_*` لا تتغير بعد تعبئتها.
7. **الواجهة خلف `CHECKOUT_ENABLED`، وهو مغلق افتراضيًا.** القيمة `true` مرفوضة في الإنتاج إلا والموقع على عنوان الجهاز نفسه (من مقترح «البساطة»). كل صفحة وكل Server Action تستدعي `requireCheckout()` أولًا.
8. **لا اعتمادية جديدة، ولا Redis، ولا طابور.** الصحة لا تعتمد على أي جدولة. انتهاء الطلبات يُكتب داخل معاملة الإنشاء وبسكربت يدوي، والقراءة تستعمل الحالة الفعلية المشتقة.

الإصلاحات المفروضة على الأساس:

| الخلل الذي وجده المحكّمان                                       | الإصلاح                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| انتهاء المهلة يسبق الدفع فيبقى مال العميل معلّقًا               | تبقى الدفعة على طلب منتهٍ مرفوضة (`order.not_payable`) ويُكتب لها سطر تدقيق كامل. والجديد **شرطان مسبقان صلبان على المرحلة 4**، مكتوبان في عقد `markOrderPaid` وفي `PAYMENTS.md` و`PROGRESS.md`: أن تنتهي جلسة المزوّد قبل `expires_at`، وأن يستثني الإنهاء أي طلب له محاولة دفع جارية. |
| طلب بالمفتاح نفسه وجوال مختلف يرجع `promotion.exhausted`        | أول جملة في المعاملة قفل استشاري على المفتاح: `pg_advisory_xact_lock(hashtextextended(key,0))`. الطلب الثاني ينتظر الأول، ثم يجد المفتاح فيرجع `order.idempotency_key_reused`.                                                                                                          |
| احتمال تعانق مع تعديل المزايا                                   | أقفال `product_versions FOR SHARE` مرتبة بالمعرّف. ترتيب الأقفال كله ثابت وموثق.                                                                                                                                                                                                        |
| خطر نمذجة المفاتيح المركّبة في Prisma 7.10                      | **بوابة نموذج أولي** في أول حزمة. المفتاح الذي لا يقبله Prisma يُستبدل بـtrigger مسمّى ومحدد مسبقًا، ويُثبت اختبار أن `prisma migrate diff` فارغ.                                                                                                                                       |
| ازدواج جداول الانتقالات بين TypeScript وplpgsql                 | الجداول في المجال فقط. الـtriggers تفرض الثوابت الخشنة فقط.                                                                                                                                                                                                                             |
| قيد يفرض `max_redemptions_per_customer = 1` لعروض العملاء الجدد | حُذف، لأنه سياسة مخترعة.                                                                                                                                                                                                                                                                |
| تأجيل منع التراكب «لأنه يحتاج btree_gist»                       | الامتداد مثبَّت فعلًا في `20261124202436_catalog_integrity`. سبب التأجيل الصحيح أن قاعدة التجديد غير محسومة.                                                                                                                                                                            |
| `customers.full_name` يُكتب من شراء ضيف                         | الاسم لقطة على الطلب وطلب التقييم فقط، ولا اسم في `customers`.                                                                                                                                                                                                                          |

حقائق من المستودع روعيت:

- `clubs.timezone` (افتراضيه Asia/Riyadh) و`clubs.currency` موجودان.
- على `product_versions` قيود CHECK على السعر والمدة، وقيد `EXCLUDE` يمنع تداخل النسخ، وقيد `currency='SAR'`.
- مفتاح `product_versions.product_id` الأجنبي هو `ON UPDATE CASCADE`، فالمفاتيح الجديدة تُعلَن `onUpdate: Restrict` صراحة.
- `seed-demo.ts` يستدعي `productVersion.deleteMany`.
- اختبار الكتالوج يحذف المزايا والنسخ مباشرة.
- `club.create` في اختبارين لا يمرّر نسبة الضريبة.
- `listMembershipPlans` لا يصفّي بالنادي، فالنادي في هذه المرحلة يُستنتج من `products.club_id`، ولا يلزم أي إعداد جديد لمعرّفه.

## الجداول

قواعد عامة:

- المعرّفات `uuid(7)` من Prisma.
- الأوقات `timestamptz(3)`، والتواريخ التقويمية `date` بتوقيت النادي.
- كل المفاتيح الأجنبية `ON DELETE RESTRICT ON UPDATE RESTRICT`.
- قيود UNIQUE والمفاتيح الأجنبية تُعلَن في `schema.prisma` حتى لا يراها `migrate diff` انحرافًا.
- CHECK والدوال والتسلسل والـtriggers تُكتب SQL في ملف الترحيل، كما في ترحيل `catalog_integrity`.
- لا فهارس جزئية.

### ترحيل A: `20261125090000_product_kind_addon`

```sql
ALTER TYPE product_kind ADD VALUE 'addon';
```

هذا الترحيل منفرد لأن قيمة enum الجديدة لا تُستعمل في المعاملة التي أُضيفت فيها.

### ترحيل B: `20261125090100_commerce`

```sql
CREATE TYPE membership_start_rule AS ENUM ('on_payment','on_first_visit');
CREATE TYPE promotion_status   AS ENUM ('draft','active','archived');
CREATE TYPE discount_kind      AS ENUM ('percentage','fixed_amount');
CREATE TYPE promotion_audience AS ENUM ('anyone','new_customer','existing_customer');
CREATE TYPE promotion_scope    AS ENUM ('all_products','listed_products');
CREATE TYPE discount_source    AS ENUM ('automatic','coupon');
CREATE TYPE order_status       AS ENUM ('pending_payment','paid','fulfilled','expired','cancelled','partially_refunded','refunded');
CREATE TYPE membership_status  AS ENUM ('scheduled','active','frozen','expired','cancelled');
CREATE TYPE refund_status      AS ENUM ('requested','approved','rejected','processing','completed','failed');
CREATE SEQUENCE order_reference_seq AS integer START 1000;   -- قبل جدول orders (تعديل يدوي للترحيل المولَّد)
```

**clubs (تعديل)**

```sql
ADD vat_rate_bps INTEGER;            -- ثم UPDATE clubs SET vat_rate_bps = 1500، ثم SET NOT NULL، بلا DEFAULT
                                     -- CHECK (vat_rate_bps BETWEEN 0 AND 10000)
ADD order_payment_window_minutes INTEGER NULL CHECK (order_payment_window_minutes > 0);  -- NULL = غير محسوم
ADD membership_start_rule membership_start_rule NULL;                                    -- NULL = غير محسوم
```

القيمة 1500 تُكتب مرة واحدة كتعبئة بيانات في الترحيل، والمرجع الحقيقة الموثقة في `SECURITY.md`. لا يوجد 15 ولا 1500 في أي كود TypeScript.

**products (تعديل):** `UNIQUE (id, kind)`.

**product_versions (تعديل)**

- `UNIQUE (id, product_id, price_minor, currency, bonus_months)`
- `UNIQUE (id, duration_months)`

**product_addons (جديد):** أي إضافة تُعرض مع أي باقة.

```
membership_product_id UUID NOT NULL, membership_kind product_kind NOT NULL DEFAULT 'membership' CHECK (= 'membership'),
addon_product_id UUID NOT NULL,      addon_kind product_kind NOT NULL DEFAULT 'addon' CHECK (= 'addon'),
sort_order INTEGER NOT NULL DEFAULT 0,
PRIMARY KEY (membership_product_id, addon_product_id),
FK (membership_product_id, membership_kind) → products(id, kind),
FK (addon_product_id, addon_kind) → products(id, kind)
```

الإضافة منتج نوعه `addon`، وله نسخ تسعير (`duration_months` فيها NULL) ومزايا في الجداول القائمة. بلا صف ربط لا تُعرض الإضافة ولا تُقبل في السلة.

**customers (جديد)**

```
id UUID PK, club_id UUID NOT NULL → clubs,
phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^\+9665[0-9]{8}$'),
created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
UNIQUE (club_id, phone_e164)
```

لا اسم هنا: من يكتب جوال غيره لا يغيّر شيئًا من بياناته.

**promotions (جديد):** العرض التلقائي والكوبون جدول واحد. `code` فارغ يعني عرضًا تلقائيًا.

```
id, club_id → clubs, code TEXT NULL CHECK (code ~ '^[A-Z0-9]{3,32}$'),
name_ar TEXT NOT NULL, name_en TEXT NOT NULL, status promotion_status NOT NULL DEFAULT 'draft',
discount_kind discount_kind NOT NULL, percent_bps INTEGER NULL, amount_minor INTEGER NULL, currency CHAR(3) NULL,
audience promotion_audience NOT NULL,          -- بلا DEFAULT: يُختار صراحةً
scope promotion_scope NOT NULL,                -- بلا DEFAULT
stackable BOOLEAN NOT NULL DEFAULT false,
starts_at TIMESTAMPTZ(3) NOT NULL, ends_at TIMESTAMPTZ(3) NULL,
max_redemptions INTEGER NULL, max_redemptions_per_customer INTEGER NULL,
created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
UNIQUE (club_id, code), INDEX (club_id, status, starts_at)
```

**promotion_products (جديد):** `(promotion_id → promotions ON DELETE CASCADE, product_id → products, PK(promotion_id, product_id))`. عرض نطاقه `listed_products` بلا صفوف هنا لا ينطبق على شيء، وهذا الاتجاه الآمن.

**orders (جديد):** الرأس، ولقطة العميل، والتسوية في صف واحد.

```
id, club_id → clubs,
reference TEXT NOT NULL UNIQUE DEFAULT ('MSR-' || lpad(nextval('order_reference_seq')::text, 7, '0')),
public_token TEXT NOT NULL UNIQUE,              -- 32 بايت عشوائي base64url (43 محرفًا)
idempotency_key UUID NOT NULL UNIQUE, request_fingerprint CHAR(64) NOT NULL,
customer_id UUID NOT NULL → customers,
customer_name TEXT NOT NULL, customer_phone_e164 TEXT NOT NULL, locale CHAR(2) NOT NULL,
status order_status NOT NULL DEFAULT 'pending_payment',
currency CHAR(3) NOT NULL, vat_rate_bps INTEGER NOT NULL,
subtotal_minor INTEGER NOT NULL, discount_minor INTEGER NOT NULL, total_minor INTEGER NOT NULL, vat_minor INTEGER NOT NULL,
created_at TIMESTAMPTZ(3) NOT NULL, expires_at TIMESTAMPTZ(3) NOT NULL,
paid_at, paid_provider, paid_provider_payment_id, paid_amount_minor, paid_currency  -- كلها NULL قبل الدفع
fulfilled_at, expired_at, cancelled_at TIMESTAMPTZ(3) NULL
```

**order_items (جديد):** اللقطة. كل سطر وحدة واحدة، ولا عمود كمية.

```
id, order_id UUID NOT NULL → orders, position SMALLINT NOT NULL,
kind product_kind NOT NULL, product_id UUID NOT NULL, product_version_id UUID NOT NULL,
product_slug, name_ar, name_en, summary_ar, summary_en TEXT NOT NULL,
benefits JSONB NOT NULL,                          -- [{"ar":..,"en":..}] بترتيب العرض
duration_months INTEGER NULL, bonus_months INTEGER NOT NULL,
membership_start_rule membership_start_rule NULL, -- القاعدة مختومة على سطر الاشتراك
currency CHAR(3) NOT NULL, vat_rate_bps INTEGER NOT NULL,
list_price_minor, discount_minor, total_minor, vat_minor INTEGER NOT NULL
```

**order_discounts (جديد):** الخصم المطبَّق، وهو نفسه سجل استخدام العرض.

```
id, order_id UUID NOT NULL, customer_id UUID NOT NULL, promotion_id UUID NOT NULL → promotions,
source discount_source NOT NULL, code TEXT NULL, name_ar, name_en TEXT NOT NULL,
discount_kind discount_kind NOT NULL, percent_bps INTEGER NULL, fixed_amount_minor INTEGER NULL,  -- لقطة القاعدة
sequence SMALLINT NOT NULL, amount_minor INTEGER NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL
```

الاستخدام «نشط» ما دام طلبه ليس `expired` ولا `cancelled`.

**memberships (جديد)**

```
id, club_id → clubs, customer_id UUID NOT NULL → customers,
order_id UUID NOT NULL UNIQUE, order_item_id UUID NOT NULL UNIQUE, order_paid_at TIMESTAMPTZ(3) NOT NULL,
item_kind product_kind NOT NULL DEFAULT 'membership' CHECK (item_kind = 'membership'),
paid_months INTEGER NOT NULL, bonus_months INTEGER NOT NULL, start_rule membership_start_rule NOT NULL,
status membership_status NOT NULL, starts_on DATE NULL, ends_on DATE NULL,   -- ends_on حدّ غير مشمول
cancelled_at TIMESTAMPTZ(3) NULL, created_at, updated_at TIMESTAMPTZ(3) NOT NULL
```

**refunds (جديد):** نموذج بيانات فقط، ولا كاتب له في هذه المرحلة.

```
id, club_id → clubs, order_id → orders, amount_minor INTEGER NOT NULL CHECK (> 0),
status refund_status NOT NULL DEFAULT 'requested', reason TEXT NOT NULL,
provider TEXT NULL, provider_refund_id TEXT NULL, UNIQUE (provider, provider_refund_id),
requested_at TIMESTAMPTZ(3) NOT NULL, decided_at NULL, completed_at NULL, INDEX (order_id)
```

**assessment_requests (جديد):** الخدمة بتقييم تنشئ طلب تقييم (ليدًا) لا طلب شراء.

```
id, club_id → clubs, customer_id → customers,
product_id UUID NOT NULL, product_kind product_kind NOT NULL DEFAULT 'assessed_service' CHECK (= 'assessed_service'),
FK (product_id, product_kind) → products(id, kind),
customer_name TEXT NOT NULL, customer_phone_e164 TEXT NOT NULL, locale CHAR(2) NOT NULL,
idempotency_key UUID NOT NULL UNIQUE, request_fingerprint CHAR(64) NOT NULL, created_at,
INDEX (customer_id, created_at)
```

لا تُخزَّن فيه بيانات صحية.

**audit_logs (جديد، إلحاق فقط)**

```
id, club_id → clubs, entity_type TEXT CHECK IN ('order','membership','refund','assessment_request'),
entity_id UUID, action TEXT NOT NULL, from_state TEXT NULL, to_state TEXT NULL,
actor TEXT NOT NULL CHECK IN ('system','customer','staff','provider'),
data JSONB NOT NULL DEFAULT '{}',   -- بلا جوال ولا اسم
created_at, INDEX (entity_type, entity_id, created_at)
```

## القيود والفهارس

### قيود CHECK

**على orders**

- `char_length(public_token) = 43`، و`reference ~ '^MSR-[0-9]{7,}$'`، و`locale IN ('ar','en')`، و`vat_rate_bps BETWEEN 0 AND 10000`.
- `subtotal_minor >= 0`، و`discount_minor >= 0`، و`total_minor > 0`، و`total_minor = subtotal_minor - discount_minor`، و`vat_minor BETWEEN 0 AND total_minor`.
- `expires_at > created_at`.
- `num_nonnulls(paid_at, paid_provider, paid_provider_payment_id, paid_amount_minor, paid_currency) IN (0,5)`.
- `paid_amount_minor = total_minor AND paid_currency = currency`: القيم الفارغة تمرّ قبل الدفع، وبعده يجب أن يطابق المبلغ والعملة تمامًا.
- `(status IN ('pending_payment','expired','cancelled')) = (paid_at IS NULL)`.
- `(status='expired') = (expired_at IS NOT NULL)`، و`expired_at IS NULL OR expired_at >= expires_at`.
- `(status='cancelled') = (cancelled_at IS NOT NULL)`.
- `status <> 'fulfilled' OR fulfilled_at IS NOT NULL`، و`fulfilled_at IS NULL OR paid_at IS NOT NULL`.
- `paid_provider ~ '^[a-z][a-z0-9_]{1,31}$'`.
- `customer_phone_e164 ~ '^\+9665[0-9]{8}$'`، و`char_length(btrim(customer_name)) BETWEEN 2 AND 120`.

**على order_items**

- `position BETWEEN 0 AND 5`: سطر أساسي وخمس إضافات على الأكثر (سقف تقني اسمه `MAX_ADDONS_PER_ORDER`).
- `kind IN ('membership','digital_program','addon')`: الخدمة بتقييم لا تدخل طلبًا.
- `(position = 0) = (kind <> 'addon')`.
- `(kind='membership') = (duration_months IS NOT NULL)`.
- `(kind='membership') = (membership_start_rule IS NOT NULL)`.
- `list_price_minor >= 0`، و`discount_minor BETWEEN 0 AND list_price_minor`، و`total_minor = list_price_minor - discount_minor`.
- `vat_minor = ((total_minor::bigint*vat_rate_bps*2 + (10000+vat_rate_bps)) / (2*(10000+vat_rate_bps)))::integer`، وهي صيغة النصف يُرفع نفسها التي في المجال.
- `jsonb_typeof(benefits)='array'`.

**على promotions**

- `(discount_kind='percentage' AND percent_bps BETWEEN 1 AND 10000 AND amount_minor IS NULL AND currency IS NULL) OR (discount_kind='fixed_amount' AND amount_minor > 0 AND currency IS NOT NULL AND percent_bps IS NULL)`.
- `ends_at IS NULL OR ends_at > starts_at`.
- `max_redemptions IS NULL OR > 0`، و`max_redemptions_per_customer IS NULL OR > 0`.
- القيد الذي يفرض حد العميل الواحد على عروض العملاء الجدد **محذوف**.

**على order_discounts**

- `sequence IN (1,2)`، و`amount_minor > 0`، و`(source='coupon') = (code IS NOT NULL)`.

**على memberships**

- `paid_months > 0`، و`bonus_months >= 0`.
- `(starts_on IS NULL) = (ends_on IS NULL)`.
- `starts_on IS NULL OR ends_on = (starts_on + make_interval(months => paid_months + bonus_months))::date`: حساب PostgreSQL يقصّ نهاية الشهر، ويطابق `addMonthsClamped`.
- `status NOT IN ('active','frozen','expired') OR starts_on IS NOT NULL`.
- `(status='cancelled') = (cancelled_at IS NOT NULL)`.

**على refunds**

- `(status='requested') = (decided_at IS NULL)`، و`(status='completed') = (completed_at IS NOT NULL)`.

**على product_versions:** القيود القائمة كما هي.

### قيود UNIQUE

| الجدول                       | القيد                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| orders                       | `idempotency_key`، `public_token`، `reference`، `(paid_provider, paid_provider_payment_id)`: دفعة المزوّد تسوّي طلبًا واحدًا |
| orders (أهداف مفاتيح مركّبة) | `(id, customer_id)`، `(id, paid_at)`                                                                                         |
| order_items                  | `(order_id, position)`، `(order_id, product_id)`، `(id, order_id, kind)`                                                     |
| order_discounts              | `(order_id, source)`، `(order_id, sequence)`، `(order_id, promotion_id)`                                                     |
| memberships                  | `order_id`: طلب واحد = اشتراك واحد، و`order_item_id`                                                                         |
| assessment_requests          | `idempotency_key`                                                                                                            |
| refunds                      | `(provider, provider_refund_id)`                                                                                             |

### المفاتيح الأجنبية المركّبة (خاضعة لبوابة Prisma)

| #   | المفتاح                                                                                                                                                         | البديل المسمّى إن رفضه Prisma 7.10                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| FK1 | `order_items(product_version_id, product_id, list_price_minor, currency, bonus_months) → product_versions(id, product_id, price_minor, currency, bonus_months)` | trigger `order_items_match_version`: BEFORE INSERT يقارن السطر بصف النسخة                                         |
| FK2 | `order_items(product_version_id, duration_months) → product_versions(id, duration_months)` (MATCH SIMPLE: يُفحص لسطور الاشتراك)                                 | ضمن `order_items_match_version`                                                                                   |
| FK3 | `order_items(product_id, kind) → products(id, kind)`                                                                                                            | — (أعمدة غير فارغة)                                                                                               |
| FK4 | `order_discounts(order_id, customer_id) → orders(id, customer_id)`                                                                                              | —                                                                                                                 |
| FK5 | `memberships(order_item_id, order_id, item_kind) → order_items(id, order_id, kind)`                                                                             | —                                                                                                                 |
| FK6 | `memberships(order_id, order_paid_at) → orders(id, paid_at)`: لا اشتراك إلا لطلب مدفوع                                                                          | trigger `memberships_require_paid_order`: BEFORE INSERT يقفل الطلب FOR SHARE ويشترط `paid_at = NEW.order_paid_at` |
| FK7 | `product_addons` و`assessment_requests` إلى `products(id, kind)`                                                                                                | —                                                                                                                 |

البوابة: أول عمل في WP1 أن يُكتب `schema.prisma` بهذه العلاقات، ثم يُشغَّل `prisma validate` و`prisma migrate dev --create-only`، ثم `prisma migrate diff --from-migrations … --to-schema … --exit-code` بعد إضافة SQL اليدوي. كل مفتاح يُرفض يُستبدل ببديله المسمّى أعلاه. اختبارات التكامل تثبت **الرفض** لا آليته، فتبقى صحيحة في الحالتين.

### دوال trigger

| #   | الاسم                                | الجدول والتوقيت                                                                                                                                                      | ما يفرضه                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | `forbid_mutation()`                  | BEFORE UPDATE OR DELETE على `order_items` و`order_discounts` و`audit_logs` و`assessment_requests`؛ BEFORE DELETE على `orders` و`memberships` و`refunds` و`customers` | يرفع استثناء دائمًا                                                                                                                                                                                                                                                                                                                                                   |
| T2  | `orders_guard_update()`              | BEFORE UPDATE على `orders`                                                                                                                                           | (أ) كل الأعمدة ثابتة عدا `status` و`paid_*` و`fulfilled_at` و`expired_at` و`cancelled_at`: يقارن `to_jsonb(NEW) - mutable` بـ`to_jsonb(OLD) - mutable`، فأي عمود لقطة يُضاف لاحقًا ثابت افتراضيًا. (ب) `paid_*` لا تتغير بعد تعبئتها. (ج) الحالات `expired` و`cancelled` و`refunded` لا تتغير. (د) لا انتقال إلى `pending_payment`. لا جدول انتقالات كامل في plpgsql. |
| T3  | `orders_assert_totals()`             | CONSTRAINT TRIGGER AFTER INSERT على `orders` و`order_items` و`order_discounts`، DEFERRABLE INITIALLY DEFERRED                                                        | عند COMMIT للطلب المعني: سطر واحد بالضبط في الموضع 0؛ وجود سطر addon يقتضي أن سطر 0 اشتراك؛ عملة كل سطر ونسبته = عملة الرأس ونسبته؛ `Σlist = subtotal`، و`Σdiscount = discount = Σorder_discounts.amount`، و`Σtotal = total`، و`Σvat = vat`                                                                                                                           |
| T4  | `order_discounts_redemption_limit()` | BEFORE INSERT على `order_discounts`                                                                                                                                  | يقفل صف العرض FOR UPDATE، ويعدّ الاستخدامات النشطة (طلباتها ليست expired ولا cancelled) إجمالًا وللعميل نفسه، ويرفع `check_violation` باسم ثابت `promotion_redemption_limit` إن بلغ أحد الحدين                                                                                                                                                                        |
| T5a | `product_versions_guard()`           | BEFORE UPDATE على `product_versions`                                                                                                                                 | `product_id` و`price_minor` و`currency` و`duration_months` و`bonus_months` و`valid_from` و`created_at` **لا تتغير أبدًا** (تغيير السعر = نسخة جديدة). `valid_until` وحده قابل للتعديل. حذف النسخة المباعة يمنعه FK RESTRICT.                                                                                                                                          |
| T5b | `product_benefits_guard()`           | BEFORE INSERT OR UPDATE OR DELETE على `product_benefits`                                                                                                             | يقفل النسخة الأم (أو النسختين عند تغيير `version_id`) FOR UPDATE، ثم يرفض إن وُجد `order_items` لها. إن لم توجد الأم فالحذف حذف متسلسل لنسخة غير مباعة فيُقبل.                                                                                                                                                                                                        |
| T6  | `memberships_guard()`                | BEFORE INSERT OR UPDATE على `memberships`                                                                                                                            | عند الإدراج: `paid_months` و`bonus_months` و`start_rule` و`customer_id` تساوي لقطة السطر والطلب. عند التحديث: الأعمدة المرجعية والأشهر وقاعدة البدء ثابتة، و`expired` و`cancelled` نهائيتان                                                                                                                                                                           |
| T7  | `refunds_guard()`                    | BEFORE INSERT OR UPDATE على `refunds`                                                                                                                                | يقفل الطلب FOR UPDATE ويشترط `paid_at IS NOT NULL`. مجموع غير المرفوض وغير الفاشل (مع الصف الجديد) ≤ `total_minor`. `order_id` و`amount_minor` ثابتان. `rejected` و`completed` و`failed` نهائية                                                                                                                                                                       |

### الفهارس

- `orders(status, expires_at)`، و`orders(customer_id, created_at)`.
- `order_discounts(promotion_id, customer_id)`.
- `memberships(customer_id, status)`، و`memberships(status, ends_on)`.
- `promotions(club_id, status, starts_at)`.
- `audit_logs(entity_type, entity_id, created_at)`، و`assessment_requests(customer_id, created_at)`، و`refunds(order_id)`.

### حدود الفيضان

- كل عمود مالي int4، أقصاه 2,147,483,647 هللة (21,474,836.47 ريال) للسطر وللطلب، وPostgreSQL يرفض ما فوقه بخطأ لا بقطع صامت.
- `MAX_AMOUNT_MINOR = 2_147_483_647` في المجال (حد تقني لنوع العمود)، و`priceCart` يرفض أي مبلغ يتجاوزه قبل القاعدة (`cart.amount_out_of_range`).
- أكبر حاصل وسيط في TypeScript: 2 × 2^31 × 10^4 ≈ 4.3×10^13، أقل من `Number.MAX_SAFE_INTEGER` ≈ 9.0×10^15. يُحسب مع ذلك بـBigInt داخل `mulDivHalfUp` و`allocateByLargestRemainder`، لأن جداء التوزيع D·r_i قد يبلغ 2^62.
- في SQL يُحوَّل الحساب إلى bigint: الحد الأقصى 4.3×10^13 من أصل 9.2×10^18. و`SUM` على int4 يرجع bigint.
- يُسجَّل في `DECISIONS.md` أن INTEGER ينسخ سطر BIGINT في `DATABASE_SCHEMA.md`، للاتساق مع `price_minor` القائم ومع `Money` المبني على number.

## محرك التسعير

المدخل:

- سطر أساسي: النسخة السارية لباقة أو برنامج رقمي.
- إضافات مرتبطة بالباقة في `product_addons`.
- عروض تلقائية مرشّحة، وكوبون اختياري.
- `vatRate` من `clubs.vat_rate_bps`.

كل سعر في الكتالوج شامل الضريبة، والضريبة تُستخرج منه ولا تُضاف عليه.

**قاعدة التقريب الوحيدة:** `mulDivHalfUp(a, n, d) = floor((2·a·n + d) / (2·d))` على أعداد صحيحة غير سالبة. تُطبَّق في موضعين فقط:

1. مبلغ الخصم المئوي.
2. ضريبة كل سطر: `vat_i = mulDivHalfUp(total_i, r, 10000 + r)`.

**قاعدة التوزيع الوحيدة:** الباقي الأكبر. نصيب السطر `floor(D·w_i / W)`، والهللات الباقية واحدة لكل سطر بترتيب الباقي الأكبر، والتعادل للموضع الأصغر.

الخطوات (`priceCart`، دالة خالصة حتمية):

1. **السطور:** الأساسي في الموضع 0، ثم الإضافات بترتيب `sort_order` ثم slug. `subtotal = Σ list_i`.
2. **الأهلية:** `checkPromotion` لكل مرشّح بترتيب ثابت: الحالة، ثم النافذة `[starts_at, ends_at)`، ثم النطاق، ثم الجمهور، ثم الحد الكلي، ثم حد العميل.
   - إن كانت مكانة العميل `unknown` (عرض سعر قبل الجوال) فالعرض المقيَّد بجمهور أو بحد للعميل يُعلَّم `promotion.audience_unverified` ولا يُطبَّق.
   - من العروض التلقائية المؤهلة يُختار الأعلى خصمًا. عند التعادل يُختار الأقدم `starts_at` ثم المعرّف الأصغر.
3. **خصم عرض P على المتبقي r_i** (يبدأ r_i = list_i):
   - السطور المؤهلة E هي السطور التي يقع منتجها في نطاق P. `base = Σ_E r_i`، وإن كان `base = 0` فالعرض لا ينطبق.
   - المئوي: `D = mulDivHalfUp(base, bps, 10000)`. الثابت: `D = min(amount, base)`.
   - التوزيع على E بالباقي الأكبر بأوزان r_i، وهذا يضمن `Σd_i = D` و`d_i ≤ r_i`.
4. **التراكم:**
   - تلقائي A وكوبون C وكلاهما `stackable = true`: يُطبَّق A أولًا (sequence 1)، ثم C على المتبقي بعده (sequence 2)، أي تتابعيًا لا جمعيًا.
   - غير ذلك، وهو الافتراضي الآمن: يُحسب كل منهما منفردًا على أسعار القائمة ويُطبَّق الأكبر خصمًا. عند التعادل يُطبَّق التلقائي، فلا يُستهلك استخدام كوبون محدود. الكوبون الخاسر يُسجَّل في `couponOutcome = not_combinable` ولا يُسجَّل له استخدام.
5. **لكل سطر:** `discount_i = Σ` ما وُزّع عليه، `total_i = list_i − discount_i`، `vat_i = mulDivHalfUp(total_i, r, 10000+r)`، `net_i = total_i − vat_i`.
6. **الرأس:** `discount = Σdiscount_i`، `total = Σtotal_i = subtotal − discount`، `vat = Σvat_i`، `net = total − vat`. السطور هي المرجع، وقد يختلف الناتج عن الاستخراج من الإجمالي مباشرة بأقل من هللة لكل سطر. هذا الاصطلاح ينتظر تأكيد محاسب النادي.
7. **الإجمالي صفر** يرجع `cart.zero_total`، ويطابقه CHECK `total_minor > 0`: لا تفعيل بلا دفعة متحقق منها.

القاعدة تتحقق من ذلك مستقلةً: CHECK ضريبة السطر، وCHECK `total = list − discount`، وCHECK الرأس، وT3 عند COMMIT.

### أمثلة

النسبة 1500، والأسعار توضيحية وليست أسعار النادي. الأرقام محسوبة وتحققت آليًا.

**مثال 1 — بلا خصم:** باقة 149900.

- vat = (2·149900·1500 + 11500) / 23000 = 19552 (الكسر 19552.17).
- net = 130348، والإجمالي 149900.

**مثال 2 — كوبون مئوي مقيَّد بالباقة:** باقة 99900 + إضافة 45000، كوبون 12.5% (1250).

- الخصم: 99900 × 1250 / 10000 = 12487.5، يُرفع إلى 12488.
- سطر الباقة: total 87412، vat 11402 (من 11401.57)، net 76010.
- سطر الإضافة: total 45000، vat 5870 (من 5869.57)، net 39130.
- الرأس: subtotal 144900، discount 12488، total 132412، vat 17272. الاستخراج من الإجمالي مباشرة يعطي 17271، والمعتمد مجموع السطور.

**مثال 3 — مبلغ ثابت موزَّع:** باقة 34900 + إضافة 15000 + إضافة 9999، كوبون ثابت 10000 على كل المنتجات.

- base = 59899، D = 10000.
- الحصص الصحيحة 5826 و2504 و1669 (= 9999)، والبواقي 28426 و12904 و18569. الهللة الباقية للباقة، فالحصص 5827 و2504 و1669.
- السطور: 29073 (vat 3792)، 12496 (vat 1630)، 8330 (vat 1087).
- الرأس: total 49899، vat 6509، net 43390.

**مثال 4 — تراكم مقابل عدم تراكم:** باقة 99900 + إضافة 45000، عرض تلقائي 10% (1000) على الباقة فقط، وكوبون ثابت 5000 على الكل.

- **الافتراضي (غير قابلين للتراكم):** التلقائي منفردًا 9990، والكوبون منفردًا 5000، فيُطبَّق التلقائي وحده. السطور 89910 (vat 11727) و45000 (vat 5870)، والإجمالي 134910، والضريبة 17597. الكوبون `not_combinable` ولا يُستهلك.
- **كلاهما stackable:** التلقائي 9990 على الباقة، فتصير 89910. ثم الكوبون على base = 134910: الحصص 3332 و1667، والبواقي 29880 و105030، فالهللة للإضافة، والحصص 3332 و1668. السطور 86578 (vat 11293) و43332 (vat 5652). الإجمالي 129910، والخصم 14990، والضريبة 16945.

## آلات الحالة

تُعرَّف كلها بدالة عامة واحدة: `nextState(machine, table, from, event)`. كل صف في الجدول `{from, event, to, blockedBy?: OpenPolicy}`. الصف المحجوب يرجع دائمًا `conflict policy.undecided.<policy>`، وما ليس في الجدول يرجع `conflict <machine>.invalid_transition`. اختبار شامل يمرّ على كل زوج (حالة، حدث). في القاعدة لا تُفرض إلا الثوابت الخشنة (T2 وT6 وT7 وقيود CHECK).

### الطلب (orders.status)

لا حالة `draft`: السلة لا تُحفظ، والطلب يُنشأ مباشرة `pending_payment`.

| من                                  | الحدث            | إلى                | الشرط والمستدعي                                                                                                                                      |
| ----------------------------------- | ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| —                                   | create           | pending_payment    | سلة صالحة، والسياسات المطلوبة محسومة، والإجمالي > 0، وT3 يتحقق. المستدعي `createOrder`                                                               |
| pending_payment                     | payment_verified | paid               | مبلغ الدفعة وعملتها = إجمالي الطلب وعملته (المجال وCHECK). يُقبل ولو تجاوز `expires_at` ما دام الصف لم يُكتب منتهيًا. المستدعي `markOrderPaid`       |
| pending_payment                     | expire           | expired            | `now ≥ expires_at`. المستدعيان `expireDueOrders` و`createOrder` (للطلبات ذات الصلة)                                                                  |
| pending_payment                     | cancel           | cancelled          | بلا مستدعٍ في المرحلة 3 (إجراء إداري لاحقًا). لا إلغاء تلقائي لطلب العميل الآخر                                                                      |
| paid                                | fulfil           | fulfilled          | سطر الاشتراك له صف `memberships`، والإضافات تتبعه. المستدعي `markOrderPaid` في المعاملة نفسها. طلب البرنامج الرقمي يبقى `paid` لأن التسليم غير محسوم |
| paid، fulfilled، partially_refunded | refund_partial   | partially_refunded | `blockedBy: refund_eligibility`، بلا مستدعٍ                                                                                                          |
| paid، fulfilled، partially_refunded | refund_full      | refunded           | `blockedBy: refund_eligibility`، بلا مستدعٍ                                                                                                          |

الحالات `expired` و`cancelled` و`refunded` نهائية. **لا انتقال `expired → paid`**: الدفعة على طلب منتهٍ ترجع `order.not_payable` ويُكتب لها سطر تدقيق.

### محاولة الدفع

شكل فقط يُعطى عقدًا للمرحلة 4، بلا جدول ولا كود الآن:

```
created → pending → authorized → captured → refunded
        ├→ failed  ├→ voided
        └→ expired
```

تُستدعى `markOrderPaid` عند `captured` فقط، بعد مطابقة الحالة والتاجر والمرجع والمبلغ والعملة من المزوّد. الحالة تتقدم فقط.

### الاشتراك (memberships.status)

| من                        | الحدث                     | إلى       | الشرط والمستدعي                                                                                                                                                                            |
| ------------------------- | ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —                         | order_fulfilled           | active    | القاعدة المختومة `on_payment` والعميل بلا اشتراك حي. `starts_on` = تاريخ الدفع بتوقيت النادي، و`ends_on = addMonthsClamped(starts_on, paid+bonus)` حدّ غير مشمول. المستدعي `markOrderPaid` |
| —                         | order_fulfilled           | scheduled | القاعدة `on_first_visit`، أو للعميل اشتراك حي (قاعدة التجديد غير محسومة). التواريخ NULL                                                                                                    |
| scheduled                 | start_confirmed(startsOn) | active    | `blockedBy: renewal_start` عند التجديد. لا مستدعٍ (أول زيارة من الـCRM في المرحلة 5)                                                                                                       |
| active                    | freeze                    | frozen    | `blockedBy: freeze_rules`، بلا مستدعٍ                                                                                                                                                      |
| frozen                    | unfreeze                  | active    | `blockedBy: freeze_rules`، بلا مستدعٍ                                                                                                                                                      |
| active                    | period_ended              | expired   | `today ≥ ends_on`، ويُشتق عند القراءة بـ`effectiveMembershipStatus`. لا كتابة في المرحلة 3                                                                                                 |
| scheduled، active، frozen | cancel                    | cancelled | `blockedBy: cancellation_rules`، بلا مستدعٍ                                                                                                                                                |

`expired` و`cancelled` نهائيتان. لا انتقال للترقية. «اشتراك حي» يعني: `scheduled` أو `frozen`، أو `active` مع `ends_on > today`.

### الاسترداد (refunds.status)

نموذج فقط، ولا دالة تنشئ استردادًا.

| من         | الحدث    | إلى        | الشرط                                                                  |
| ---------- | -------- | ---------- | ---------------------------------------------------------------------- |
| —          | request  | requested  | الطلب مدفوع، والمجموع ≤ الإجمالي (T7). `blockedBy: refund_eligibility` |
| requested  | approve  | approved   | `blockedBy: refund_eligibility`                                        |
| requested  | reject   | rejected   | —                                                                      |
| approved   | start    | processing | —                                                                      |
| processing | complete | completed  | —                                                                      |
| processing | fail     | failed     | —                                                                      |

الحالات `rejected` و`completed` و`failed` نهائية.

## المعاملات والتزامن

كل العمليات معاملات Prisma تفاعلية بعزل READ COMMITTED، والأقفال صريحة عبر `$queryRaw`. السبب: في هذا العزل كل جملة بعد انتظار القفل تأخذ لقطة جديدة فترى ما اعتُمد قبلها، فلا حاجة إلى SERIALIZABLE ولا إلى حلقات إعادة محاولة. القيود والـtriggers هي السدّ إن نسي الكود قفلًا.

**ترتيب الأقفال الثابت**

- `createOrder`: قفل استشاري على المفتاح ← `customers` FOR UPDATE ← `product_versions` FOR SHARE مرتبة بالمعرّف ← `promotions` FOR UPDATE مرتبة بالمعرّف ← طلبات فاتت مهلتها FOR UPDATE SKIP LOCKED.
- `markOrderPaid`: `orders` FOR UPDATE ← `customers` FOR UPDATE.
- `expireDueOrders`: `orders` FOR UPDATE SKIP LOCKED فقط.

`createOrder` لا ينتظر أبدًا قفل طلب قائم، فلا دورة انتظار بينه وبين `markOrderPaid`. لوحة إدارة المزايا (المرحلة 5) يجب أن تقفل النسخ بترتيب المعرّف أيضًا. وأي تعانق نادر يكتشفه PostgreSQL ويُلغي إحدى المعاملتين بلا فساد.

### 1) createOrder (معاملة واحدة)

1. `pg_advisory_xact_lock(hashtextextended(idempotency_key::text, 0))`.
2. SELECT الطلب بالمفتاح: إن وُجد وبصمته مطابقة يُرجَع (`replayed`)، وإن اختلفت فالنتيجة `order.idempotency_key_reused` بلا كتابة.
3. تحميل المنتج الأساسي بـslug، ومنه النادي، ثم سياسته. إن كانت `checkoutBlockers` غير فارغة فالنتيجة `policy.undecided.*`.
4. `INSERT customers … ON CONFLICT DO NOTHING`، ثم `SELECT … FOR UPDATE`. هذه نقطة التسلسل لكل طلبات الجوال نفسه.
5. تحميل العروض (النسخ السارية للأساسي والإضافات المطلوبة)، ثم `SELECT id FROM product_versions WHERE id = ANY($1) ORDER BY id FOR SHARE`، ثم قراءة المزايا **بعد** القفل.
6. المرشّحون: العروض التلقائية الفعّالة المتقاطعة مع منتجات السلة، والكوبون بالرمز، ثم `FOR UPDATE ORDER BY id`.
7. إنهاء الطلبات المستحقة لهذا العميل أو الحاملة لهذه العروض، بـSKIP LOCKED مع سطور تدقيق.
8. قراءة الاستخدام النشط، والمكانة (هل للعميل طلب `paid_at` غير فارغ؟)، وعدد طلباته المعلّقة. إن بلغ الحد التقني `MAX_PENDING_ORDERS_PER_CUSTOMER` فالنتيجة `order.too_many_pending`.
9. `buildOrderDraft(facts)`، وهي الدالة الخالصة التي تقرر كل شيء.
10. إن اختلف `draft.total` عن `quotedTotalMinor` بأي اتجاه فالنتيجة `cart.price_changed` بلا كتابة، ومعها الإجمالي الجديد.
11. INSERT للطلب ثم السطور ثم الخصومات ثم التدقيق.
12. COMMIT، ويعمل T3. خطأ العمل يُرمى داخل المعاملة فتتراجع كلها (ومنها صف العميل الجديد)، ثم يُحوَّل إلى Result.

### 2) markOrderPaid (نقطة تسليم المرحلة 4)

1. `SELECT … FROM orders WHERE id=$1 FOR UPDATE`.
2. `decideSettlement`:
   - `replay`: الدفعة نفسها مسجّلة، فتُرجَع النتيجة نفسها ومعرّف الاشتراك القائم بلا كتابة.
   - رفض (`order.already_paid`، `order.not_payable`، `payment.amount_mismatch`، `payment.currency_mismatch`): يُكتب سطر تدقيق `payment_rejected` بالمزوّد والمعرّف والمبلغ، ثم COMMIT، ويُرجَع الخطأ.
3. فحص مسبق: هل `(provider, provider_payment_id)` مستعمل في طلب آخر؟ إن كان فالنتيجة `payment.already_used`. القيد الفريد هو السدّ الأخير.
4. `UPDATE orders SET status='paid', paid_* … WHERE id=$1 AND status='pending_payment'`، ويجب أن يمسّ صفًا واحدًا.
5. إن كان في الطلب سطر اشتراك:
   - قفل صف العميل FOR UPDATE، وفحص الاشتراك الحي.
   - `decideMembershipStart`، بقاعدة البدء المختومة على السطر والمنطقة الزمنية من `clubs.timezone`.
   - INSERT memberships.
6. إن لم يكن فيه سطر برنامج رقمي: `UPDATE … status='fulfilled'`.
7. التدقيق، ثم COMMIT. لا استدعاء خارجي داخل المعاملة.

### 3) expireDueOrders(db, now, limit)

```sql
UPDATE orders SET status='expired', expired_at=$now
WHERE id IN (SELECT id FROM orders WHERE status='pending_payment' AND expires_at <= $now
             ORDER BY expires_at LIMIT $n FOR UPDATE SKIP LOCKED)
RETURNING id
```

مع سطور تدقيق في CTE.

يُستدعى من `createOrder` (الخطوة 7)، ومن سكربت `pnpm --filter @masar/db orders:expire`. جدولته مؤقت systemd أو cron عند النشر، لا pg-boss لهذه المهمة. الصحة لا تعتمد على الجدولة: القراءة تستعمل `effectiveOrderStatus`، والطلب المعلّق الفائتة مهلته يبقى حاجزًا لكوبونه حتى يُكتب منتهيًا، وهذا هو الاتجاه الآمن.

### السباقات وما يمنع كلًّا منها

**(أ) آخر استخدام لكوبون**

- يتسلسل الطلبان على قفل صف العرض (الخطوة 6).
- الثاني يعدّ بعد اعتماد الأول فيرى سطر `order_discounts` المعتمد، فيرجع `promotion.exhausted` (على حقل الكوبون) بلا طلب.
- إن نسي الكود القفل أو العدّ، فإن T4 يقفل صف العرض نفسه ويعدّ عند كل إدراج.
- التحرير تلقائي حين يصير الطلب `expired` أو `cancelled`، وهاتان نهائيتان (T2)، فلا تُحيي دفعة متأخرة استخدامًا محرَّرًا: **حد الكوبون لا يُتجاوز في أي ترتيب**.

**(ب) نداءات تسجيل الدفع مكررة أو متزامنة**

- الثاني ينتظر FOR UPDATE ثم يجد الدفعة نفسها فيرجع `replay` بالاشتراك نفسه.
- السدود في القاعدة حتى لو حُذف القفل:
  - `UNIQUE(memberships.order_id)`.
  - FK6 الذي يمنع اشتراكًا لطلب غير مدفوع.
  - T2 الذي يمنع تغيير `paid_*`.
  - `UNIQUE(paid_provider, paid_provider_payment_id)`.
  - CHECK المبلغ والعملة.

**(ج) انتهاء المهلة يسابق الدفع**

- كلاهما UPDATE مشروط بـ`status='pending_payment'` على الصف نفسه، فالفائز من يأخذ القفل أولًا.
- إن فاز الدفع: الإنهاء يتخطى الصف (SKIP LOCKED)، أو يعيد تقييم الشرط فلا يجده.
- إن فاز الإنهاء: يرجع `order.not_payable` بلا تفعيل، ويُكتب سطر تدقيق فيه بيانات الدفعة.
- يمنع هذا الترتيبَ الأخير **شرطان صلبان على المرحلة 4**:
  1. تنتهي جلسة المزوّد أو رابط الدفع قبل `expires_at` بهامش.
  2. يستثني `expireDueOrders` كل طلب له محاولة دفع `pending` أو `authorized`.
- معالجة دفعة وصلت مع ذلك (استرداد أو تفعيل يدوي) قرار مالك مفتوح، ولا يُنفَّذ شيء آليًا.

**(د) إنشاء طلب مكرر**

- القفل الاستشاري يسلسل كل الطلبات بالمفتاح نفسه، مهما اختلف الجوال.
- الثاني يجد الطلب: إما `replay` أو `idempotency_key_reused`.
- `UNIQUE(idempotency_key)` هو السدّ الأخير، وعند خطأ الفرادة يُعاد مسار القراءة.

**(هـ) تعديل نسخة أثناء بيعها**

- السعر والمدة والأشهر المجانية لا تتغير أبدًا (T5a)، فلا سباق عليها.
- المزايا: FOR SHARE في الطلب مقابل FOR UPDATE في T5b. إن سبق الطلب انتظر التعديل ثم رُفض. وإن سبق التعديل انتظر الطلب ثم قرأ المزايا الجديدة بعد القفل.
- FK1 وFK2 يمنعان لقطة تخالف نسختها.

**(و) مجاميع لا تطابق السطور:** T3 عند COMMIT، وT1 وT2 يمنعان أي تعديل لاحق.

**(ز) طلبان مدفوعان متزامنان للعميل نفسه:** قفل صف العميل في `markOrderPaid` يسلسل فحص الاشتراك الحي، فلا يُفعَّل اشتراكان متراكبان. الثاني يُنشأ `scheduled`.

### 4) createAssessmentRequest

معاملة واحدة: قفل استشاري على المفتاح ← العميل ← SELECT بالمفتاح والبصمة ← INSERT مع سطر تدقيق. FK7 يرفض أي منتج ليس `assessed_service`.

## مسار الشراء

**العلم**

- `CHECKOUT_ENABLED` في `parse-env.ts` بنمط `SITE_INDEXABLE`: القيمة `"true"` حرفيًا فقط تفتح، والافتراضي مغلق.
- `refine` يرفض الإقلاع إن كان `NODE_ENV=production` و`CHECKOUT_ENABLED=true` و`SITE_URL` ليس عنوان الجهاز نفسه (`LOOPBACK_HOSTS` القائمة). معاينة sslip.io العامة لا تستطيع تفعيله، واختبار البناء الإنتاجي على 127.0.0.1 يستطيع.
- `server/checkout/flag.ts` فيه `isCheckoutEnabled()` و`requireCheckout()`، والثانية تستدعي `notFound()`. كل صفحة checkout وكل Server Action تبدأ بها.

**والعلم مغلق:** صفحة الباقة كما هي (زر واتساب، القرار 18)، وكل `/checkout/*` ترجع 404.

**والعلم مفتوح:** زر الشراء في `PlanSummary` و`StickyPurchaseBar` رابط داخلي إلى `/checkout/<slug>`، وواتساب رابط نصي ثانوي.

**المسارات** تحت `app/[locale]`، كلها ديناميكية و`robots: noindex` ومن غير كاش:

1. **`/memberships/[slug]`** (قائمة): اختيار الباقة.
2. **`/checkout/[slug]`**: صفحة خادم.
   - `searchParams`: `addon` (متكرر، خمسة على الأكثر) و`coupon`.
   - تستدعي `getCheckoutQuote`، وهي `quoteCart` بمكانة `unknown`.
   - تعرض السطور والمدة («3 أشهر + شهر مجاني»)، والخصومات بأسمائها، والمجموع، والإجمالي الشامل، و«منه ضريبة القيمة المضافة X%»، ونص قاعدة البدء من القاموس.
   - نموذج GET للإضافات والكوبون بلا JavaScript.
   - العرض المقيَّد بجمهور يظهر «يُتحقق من الأهلية عند التأكيد».
   - إن كانت سياسة غير محسومة (`policy.undecided.*`) تعرض «الشراء الإلكتروني غير متاح حاليًا» مع واتساب، بلا نموذج.
   - المنتج غير المعروض أو غير القابل للشراء يرجع 404.
   - ثم نموذج البيانات `CheckoutDetailsForm`، وهو المكوّن العميل الوحيد:
     - يستعمل `useActionState`، ويعمل بلا JavaScript.
     - الحقول: الاسم (`autocomplete=name`) والجوال (`inputmode=tel`، `dir=ltr`).
     - حقول مخفية: `idempotencyKey` (`crypto.randomUUID()` عند العرض)، و`quotedTotalMinor`، والباقة، والإضافات، والكوبون، واللغة.
     - لا حقل عمر ولا دفع.
3. **الإجراء `submitCheckout(prev, formData)`** في `server/checkout/actions.ts` (`"use server"`):
   - الترتيب: `requireCheckout()` ← مخطط zod للشكل والأطوال ← `parseBuyer` (كل أخطاء الحقول معًا) و`parseCouponCode` ← `placeOrder`، ثم `redirect` إلى صفحة الطلب.
   - `placeOrder` يولّد `publicToken` بـ`randomBytes(32)` base64url، ويحسب البصمة بـsha256، ويمرّر `MAX_PENDING_ORDERS_PER_CUSTOMER`.
   - حماية CSRF من فحص Origin المضمّن في Server Actions ومن `form-action 'self'` القائم. يُقرأ قبل الكتابة `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` و`forms.md`.
4. **`/checkout/orders/[token]`** (مراجعة الطلب): من اللقطة فقط عبر `findOrderByPublicToken`.
   - تعرض: المرجع `MSR-…`، والاسم، والجوال مقنَّعًا (آخر رقمين)، والسطور ومزاياها، والخصومات، والضريبة، والإجمالي، والحالة الفعلية، وموعد انتهاء المهلة بتوقيت النادي، وقاعدة البدء المختومة.
   - الخطوة التالية نص صادق: «الدفع الإلكتروني غير متاح بعد»، ورابط واتساب يحمل المرجع. **لا زر دفع ولا محاكاة.**
   - طلب منتهٍ: «انتهت مهلة هذا الطلب» ورابط بدء جديد.
   - رمز غير معروف: 404.
   - لا نص عن استرداد أو إلغاء.

**الأخطاء والاسترجاع** (كل نص من القواميس، ومفاتيح الأسباب `Record` مضبوط بالأنواع، فنقص ترجمة خطأ أنواع):

| الحالة                                                                    | السلوك                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| اسم أو جوال خاطئ                                                          | الرسالة بجانب الحقل (`aria-describedby`)، والمدخلات محفوظة، والمفتاح نفسه                                                                                                                    |
| كوبون غير صالح (`promotion.*`، `coupon.unknown`، `coupon.invalid_format`) | الخطأ على الحقل `coupon`، ولا طلب حتى يُزال أو يُصحَّح، والسعر المعروض بلا خصمه                                                                                                              |
| الكوبون خسر أمام عرض أفضل                                                 | الطلب يُنشأ، ويُذكر ذلك قبل الإرسال في الملخص                                                                                                                                                |
| `cart.price_changed`                                                      | الحالة ترجع الإجمالي الجديد وتنبيهًا ومفتاحًا جديدًا. الحقل المخفي يأخذ الإجمالي الجديد، فالتأكيد الثاني يطابق ولا تنشأ حلقة، حتى حين يأتي فرق السعر من عرض مقيَّد بجمهور لا يظهر قبل الجوال |
| `order.idempotency_key_reused`                                            | مفتاح جديد ورسالة «تغيّرت البيانات، أكّد مرة أخرى»                                                                                                                                           |
| `order.too_many_pending`                                                  | رسالة ومسار واتساب                                                                                                                                                                           |
| `cart.product_unavailable`                                                | رسالة ورابط إلى الباقات                                                                                                                                                                      |
| ضغطتان                                                                    | طلب واحد والتحويل إلى الصفحة نفسها                                                                                                                                                           |
| عطل قاعدة                                                                 | يُسجَّل منقّحًا بلا جوال، وتظهر `error.tsx` القائمة                                                                                                                                          |

**الاختبار الطرفي:** خادم Playwright ثانٍ على المنفذ 3101 بـ`CHECKOUT_ENABLED=true` ومشروع خاص به. الخادم القائم يثبت أن العلم مغلق.

## السياسات غير المحسومة

| السياسة                                                            | كيف تبقى مفتوحة                                                                                                                                        | السلوك الآمن حتى الحسم                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| قواعد التجميد (المدة والعدد)                                       | `freeze` و`unfreeze` صفّان في جدول الاشتراك `blockedBy: freeze_rules` بلا مستدعٍ. لا جدول `membership_freezes`، وT6 يمنع أي تمديد                      | `policy.undecided.freeze_rules`. لا واجهة ولا وعد. التجميد عبر الـCRM كما اليوم                                                |
| الترقية                                                            | غير ممثلة: لا حدث ولا عمود ولا ربط بين طلبين                                                                                                           | لا ترقية أونلاين. شراء جديد لعميل له اشتراك حي ينشئ اشتراكًا `scheduled` بلا تواريخ، ولا يمسّ القائم                           |
| إلغاء الاشتراك                                                     | `cancel` صف `blockedBy: cancellation_rules`. وانتقال الطلب `pending_payment→cancelled` بلا مستدعٍ                                                      | لا إلغاء من المنصة، ولا نص سياسة يُعرض                                                                                         |
| أهلية الاسترداد («لا استرداد، التجميد فقط» تحت المراجعة القانونية) | جدول `refunds` وT7 وآلة الحالة، و`request` و`approve` محجوبان `blockedBy: refund_eligibility`. انتقالا الطلب للاسترداد محجوبان. لا دالة تكتب استردادًا | لا استرداد يُنشأ أو يُعالج أو يُوعد به. لا صفحة سياسة                                                                          |
| تاريخ بدء الاشتراك (الدفع أم أول زيارة)                            | `clubs.membership_start_rule` = NULL. `checkoutBlockers` يشترطه لطلبات الاشتراك. يُختم على سطر الطلب (CHECK)                                           | لا يُنشأ أي طلب اشتراك (`policy.undecided.membership_start_rule`)، والصفحة تعرض «غير متاح». تغييره لاحقًا لا يمسّ طلبًا سابقًا |
| بدء التجديد (من الانتهاء أم من الدفع)                              | `decideMembershipStart` يأخذ `hasLiveMembership`. `start_confirmed` محجوب `blockedBy: renewal_start`                                                   | يُنشأ اشتراك `scheduled` بتواريخ NULL: الاستحقاق محفوظ ولا تاريخ مخترع ولا تراكب                                               |
| تراكم الكوبونات والعروض                                            | `promotions.stackable` لكل عرض، وافتراضيه false. عرض تلقائي واحد وكوبون واحد على الأكثر (UNIQUE)                                                       | يُطبَّق الخصم الأكبر وحده، ولا يُستهلك الكوبون الخاسر. يتراكمان تتابعيًا فقط إن علّمهما المالك معًا                            |
| مهلة الطلب غير المدفوع                                             | `clubs.order_payment_window_minutes` = NULL. `orders.expires_at NOT NULL`                                                                              | لا يُنشأ أي طلب (`policy.undecided.order_payment_window`). لا قيمة في الكود. البذرة التجريبية وحدها تضبط قيمة معلَّمة تجريبية  |
| سن القبول                                                          | لا حقل ولا عمود ولا نص. مانع للإطلاق العام في `PROGRESS.md`                                                                                            | لا يُجمع عمر ولا يُدّعى شرط، والبيع مغلق بالعلم ومرفوض في الإنتاج                                                              |
| الباقة «الموصى بها»                                                | لا عمود. يبقى القرار 22 (الأقل تكلفة شهريًا، محسوبة)                                                                                                   | مسار الشراء لا يعلّم باقة ولا يقترح بديلًا                                                                                     |
| تعريف «عميل جديد»                                                  | `CustomerStanding` يُحسب في موضع واحد (طلب مدفوع على المنصة أم لا) ويُمرَّر إلى التسعير                                                                | لا يُنشأ عرض بجمهور مقيَّد قبل قرار المالك. مشترك الـCRM يبدو جديدًا                                                           |
| الدفعة بعد إنهاء الطلب                                             | `markOrderPaid` ترجع `order.not_payable` وتكتب تدقيقًا كاملًا                                                                                          | لا تفعيل ولا تغيير للطلب. شرطا المرحلة 4 الصلبان يمنعان وقوعها، والمعالجة قرار مالك                                            |
| الطلب بإجمالي صفر                                                  | CHECK `total_minor > 0` و`cart.zero_total`                                                                                                             | مرفوض: لا تفعيل بلا دفعة متحقق منها                                                                                            |
| تسليم البرنامج الرقمي                                              | الطلب الرقمي يبقى `paid`، و`fulfil` له بلا مستدعٍ                                                                                                      | لا واجهة شراء للبرامج في هذه المرحلة                                                                                           |
| الإضافات المباعة فعلًا (المواصفات تجعل التدريب الشخصي خدمة بتقييم) | الآلية فقط: `kind='addon'` و`product_addons`                                                                                                           | بلا صفوف ربط لا تُعرض إضافة ولا تُقبل                                                                                          |
| اصطلاح الأشهر (ميلادي تقويمي، قصّ آخر الشهر، `ends_on` غير مشمول)  | `addMonthsClamped` وCHECK في القاعدة، وكلاهما في موضع واحد                                                                                             | لا اشتراك يُفعَّل قبل المرحلة 4. يُعرض على المالك بأمثلة                                                                       |
| اصطلاح تقريب الضريبة (لكل سطر، النصف يُرفع)                        | `mulDivHalfUp` وCHECK السطر                                                                                                                            | التفصيل معلوماتي. المنصة لا تصدر فاتورة ضريبية                                                                                 |
| نص قبول الشروط عند الشراء                                          | لا نص ولا حقل                                                                                                                                          | لا وعد قانوني قبل المراجعة                                                                                                     |

## المؤجَّل

- **الدفع الحي** (`payment_attempts`، `payment_transactions`، `provider_events`، المطابقة) → المرحلة 4. المرحلة 3 تسلّم `markOrderPaid` و`VerifiedPayment` وشرطين صلبين: الجلسة تنتهي قبل المهلة، والإنهاء يستثني المحاولات الجارية.
- **معالجة الاسترداد وأي دالة تنشئ صف `refunds`** → المرحلة 4، بعد قرار المالك والمراجعة القانونية.
- **`membership_freezes` وتمديد `ends_on`** → عند حسم التجميد، مع تعديل CHECK تاريخ الانتهاء وT6 في الترحيل نفسه.
- **الترقية وتغيير الباقة** → حين يقرر المالك.
- **منع تراكب الاشتراكات بقيد استبعاد** (الامتداد btree_gist مثبَّت أصلًا) → حين تُحسم قاعدة التجديد.
- **جدولة `orders:expire`** (مؤقت systemd أو cron) **وكتابة انتهاء الاشتراكات** → مع النشر. الصحة لا تعتمد عليهما.
- **`outbox_events` وأحداث الـCRM** (طلب مدفوع، سلة متروكة، ليد التقييم) → المرحلة 5. موضع الإدراج محدد في `markOrderPaid` و`createAssessmentRequest`.
- **واجهة حجز التقييم** → المرحلة 6. الآن الجدول والدالة والاختبارات.
- **صفحات البرامج الرقمية وتسليمها** → عند حسم التسليم.
- **لوحة إدارة الكتالوج والعروض** → المرحلة 5. البيانات الآن بالبذرة التجريبية والاختبارات.
- **`attributions`** (UTM) **و`consents` وأحداث التحليلات والفواتير** → المرحلة 5.
- **التحقق من الجوال برمز، وتحديد المعدل بعنوان IP** → قبل أي فتح عام. الآن العلم المرفوض في الإنتاج وسقف الطلبات المعلّقة.
- **كميات أكبر من 1، وأكواد فريدة بالجملة، وقواعد تراكم متقدمة** → بعد النقل.
- **فصل دور قاعدة التطبيق عن دور الترحيل وسحب TRUNCATE من الإنتاج** → مع النشر.

## خطة الاختبار

**وحدة — المجال (التسعير)**

- `mulDivHalfUp`: النصف يُرفع وما دونه يُخفض، والقيم الحدّية 0 و1 وأقصى int4، والسالب أو المقام الصفري يرمي invariant.
- `allocateByLargestRemainder`: المجموع = المبلغ دائمًا، ولا حصة تتجاوز وزنها، وتعادل الباقي للموضع الأصغر. اختبار خصائص ببذرة ثابتة، ومسار BigInt عند حد int4.
- `vatIncludedIn`: الأمثلة الأربعة هللةً بهللة، ونسبة 0 تعطي صفرًا، و`basisPoints` يرفض السالب والكسر وما فوق 10000.
- `priceCart`:
  - الأمثلة 1-4.
  - خصم مقيَّد لا يمسّ سطرًا خارج نطاقه.
  - الخصم الثابت يُقصّ عند الأساس.
  - خصم 100% يرجع `cart.zero_total`.
  - فوق الحد يرجع `cart.amount_out_of_range`.
  - خصائص: مجاميع السطور = الرأس ولا سالب، لسلال مولّدة.
- `checkPromotion`: كل سبب رفض عند لحظتي البداية والنهاية بالضبط، و`unknown` يرفض المقيَّد ويقبل `anyone`.
- `parseCouponCode` و`validateCart`: إضافة غير مرتبطة، أو مكررة، أو أكثر من خمس، أو مع برنامج رقمي.

**وحدة — المجال (دورة الحياة)**

- `nextState` لجداول الطلب والاشتراك والاسترداد: مسح شامل للجداء، ولا مسار يعود إلى `pending_payment`، ولا `expired→paid`، والمحجوب يرجع `policy.undecided.*`.
- `effectiveOrderStatus` عند `expires_at` بالضبط.
- `decideSettlement`: `apply`، و`replay`، و`already_paid`، ونقص هللة، وعملة أخرى، وطلب منتهٍ أو ملغى.
- `plainDateInZone`: 21:00Z تقع في اليوم التالي بالرياض، و20:59Z في اليوم نفسه.
- `addMonthsClamped`: 31 يناير + شهر = 28 فبراير (29 في الكبيسة)، و30 نوفمبر + 14 = 30 يناير.
- `membershipPeriod` تضم الأشهر المجانية.
- `decideMembershipStart` بحالاته الثلاث.
- `effectiveMembershipStatus` يوم `ends_on` (منتهٍ، لأنه حدّ غير مشمول) واليوم السابق له.
- `parseBuyer` يرجع كل أخطاء الحقول معًا وينظّف محارف الاتجاه.
- `canonicalOrderRequest` لا يتأثر بترتيب الإضافات، ويتغير بالجوال والكوبون.
- `replayDecision`.

**وحدة — المجال (التجميع)**

- `checkoutBlockers`.
- `buildOrderDraft`:
  - كل سياسة NULL.
  - الكوبون المرفوض على الحقل `coupon`.
  - اللقطة تحمل الاسم والمدة والمزايا والسعر وقاعدة البدء.
  - `too_many_pending`.
  - المكانة الحقيقية تطبّق عرض الجمهور.
- `buildQuote` بمكانة `unknown`.
- `validateAssessmentRequest`.

**وحدة — الويب**

- `parseEnv`: يفتح بـ`"true"` حرفيًا فقط، ويرفضه في الإنتاج على غير عنوان الجهاز.
- `requireCheckout` والإجراء يرجعان notFound والعلم مغلق، ولا يلمسان القاعدة.
- `purchaseHref`: واتساب مقابل `/checkout/slug`.
- مخطط النموذج: مفتاح ليس UUID، وأطوال، وأكثر من خمس إضافات.

**تكامل — قيود القاعدة** (SQL خام على PostgreSQL حقيقي)

- تعديل سعر أو مدة أو أشهر مجانية أو `valid_from` لأي نسخة مرفوض، و`valid_until` مقبول.
- مزايا نسخة مباعة لا تُضاف ولا تُعدَّل ولا تُحذف. نسخة غير مباعة تُحذف مع مزاياها.
- سطر سعره يخالف نسخته، أو مدته تخالفها، أو منتجه `assessed_service`، أو أكثر من سطر أساسي، أو سطر addon مع برنامج رقمي: كلها مرفوضة.
- ضريبة سطر تخالف الصيغة بهللة واحدة مرفوضة.
- T3: طلب بمجموع مخالف، أو بلا سطر أساسي، أو بخصومات لا تطابق، يفشل عند COMMIT.
- UPDATE أو DELETE على `order_items` و`order_discounts` و`audit_logs`، وتعديل `total_minor` أو `customer_name`، وحذف طلب: كلها مرفوضة.
- `expired→paid` و`paid→pending_payment` و`paid→expired` بـSQL خام: مرفوضة.
- `paid_*` جزئية، أو مبلغ أو عملة مخالفة: مرفوضة بالـCHECK.
- اشتراك ثانٍ للطلب، أو لطلب غير مدفوع، أو لسطر addon، أو بأشهر تخالف السطر، أو بتاريخ انتهاء يخالف الحساب: كلها مرفوضة.
- T4: إدراج خام يتجاوز حد الكوبون مرفوض ولو تخطّى الكود.
- استرداد يتجاوز الإجمالي، أو لطلب غير مدفوع: مرفوض.
- `assessment_requests` لمنتج اشتراك مرفوض.
- تطابق الحسابين: تاريخ الانتهاء في TypeScript = ناتج PostgreSQL لألف مدخل مولّد.
- `prisma migrate diff` فارغ.
- `isUniqueViolation` وأسماء القيود تُعرَف من خطأ محوّل Prisma 7 الحقيقي.

**تكامل — المستودعات**

- `createOrder` يحفظ اللقطة والمرجع والمهلة. نسخة جديدة وأرشفة المنتج بعده لا تغيّران `findOrderByPublicToken`.
- التكرار: نداءان بالمفتاح نفسه يعطيان طلبًا واحدًا. عشرون متزامنة تعطي طلبًا واحدًا. المفتاح نفسه بجوال آخر متزامنًا مع كوبون بحد 1 يرجع `idempotency_key_reused` لا `exhausted`.
- `cart.price_changed` بلا كتابة.
- كل سياسة NULL تمنع الإنشاء.
- عشرة عملاء متزامنون على كوبون حده 1: طلب واحد بالخصم.
- حد العميل يُحترم، ويتحرر بعد إنهاء الطلب.
- طلب فاتت مهلته ولم يُنهَ يبقى حاجزًا حتى يُنهى في الإنشاء.
- `too_many_pending`.
- فشل التسعير لا يترك عميلًا.
- `markOrderPaid`:
  - ينشئ اشتراكًا واحدًا بتواريخ الرياض، والطلب `fulfilled`.
  - عشرون متزامنة: اشتراك واحد ونتيجة واحدة.
  - `already_paid`، و`already_used`، والمبلغ أو العملة المخالفة مع سطر تدقيق، و`not_payable` لطلب منتهٍ.
  - طلب رقمي يبقى `paid`.
  - `on_first_visit` يعطي `scheduled`، والاشتراك الحي يعطي `scheduled`.
- سباق `expireDueOrders` مع `markOrderPaid` مئة مرة: النتيجة دائمًا إما منتهٍ بلا اشتراك، أو مدفوع باشتراك واحد.
- `expireDueOrders` لا يسبق المهلة، ويتخطى المقفل، ولا يمسّ المدفوع، وتشغيله مرتين بلا أثر ثانٍ.
- `createAssessmentRequest` يعطي صفًا واحدًا عند التكرار.
- كل انتقال يكتب سطر تدقيق.
- البذرة التجريبية تُشغَّل مرتين بلا خطأ.

**متصفح**

- العلم مغلق: `/checkout/*` ترجع 404 والزر واتساب.
- العلم مفتوح: باقة ← بيانات ← مراجعة، والإجمالي واحد في الخطوات الثلاث، بالعربية والإنجليزية.
- جوال خاطئ: الخطأ بجانب الحقل والاسم محفوظ.
- كوبون منتهٍ: رسالته والسعر بلا خصم.
- ضغطتان: طلب واحد.
- المسار يعمل وJavaScript معطَّل.
- لا زر دفع في أي حالة.
- فحص axe ولقطات المقاسات السبعة لصفحتي البيانات والمراجعة.

## حزم التنفيذ

حزم الموجة الواحدة تمس ملفات منفصلة فيمكن بناؤها بالتوازي.

### WP1 — المخطط والترحيلان وقيود القاعدة واختباراتها وتهيئة البذرة والاختبارات القائمة (الموجة 1)

**الملفات:** `packages/db/prisma/schema.prisma`، `packages/db/prisma/migrations/20261125090000_product_kind_addon/migration.sql`، `packages/db/prisma/migrations/20261125090100_commerce/migration.sql`، `packages/db/prisma/seed-demo.ts`، `packages/db/src/catalog.integration.test.ts`، `packages/db/src/client.integration.test.ts`، `packages/db/src/test-support/reset-database.ts`، `packages/db/src/test-support/commerce-fixtures.ts`، `packages/db/src/commerce-schema.integration.test.ts`، `packages/db/src/commerce-guards.integration.test.ts`، `docs/DATABASE_SCHEMA.md`، `docs/DECISIONS.md`

الهدف: كل ما في قسمي «الجداول» و«القيود والفهارس» من التصميم، حرفيًا.

0. بوابة Prisma (أول ساعة عمل):

- اكتب في schema.prisma:
  - النماذج: Customer, Promotion, PromotionProduct, ProductAddon, Order, OrderItem, OrderDiscount, Membership, Refund, AssessmentRequest, AuditLog.
  - الـenums بـ@@map: membership_start_rule, promotion_status, discount_kind, promotion_audience, promotion_scope, discount_source, order_status, membership_status, refund_status. وأضف القيمة addon إلى ProductKind.
  - أعمدة clubs الجديدة: vatRateBps Int، orderPaymentWindowMinutes Int?، membershipStartRule MembershipStartRule?.
  - كل @@unique المذكورة، ومنها: products(id, kind)؛ product_versions(id, productId, priceMinor, currency, bonusMonths) و(id, durationMonths)؛ orders(id, customerId) و(id, paidAt)؛ order_items(id, orderId, kind).
  - العلاقات المركّبة FK1..FK7 بأسماء علاقات صريحة، و onDelete: Restrict, onUpdate: Restrict على كل علاقة جديدة.
- شغّل prisma validate و prisma migrate dev --create-only.
- أي علاقة يرفضها Prisma 7.10 (المرشحان FK2 بسبب duration_months الفارغ، وFK6 بسبب paid_at الفارغ) تُزال من schema.prisma، ويُكتب بديلها المسمّى في SQL:
  - order_items_match_version: BEFORE INSERT على order_items؛ يقارن product_id و price_minor و currency و bonus_months و duration_months مع صف النسخة.
  - memberships_require_paid_order: BEFORE INSERT على memberships؛ SELECT paid_at FROM orders WHERE id=NEW.order_id FOR SHARE، ويشترط paid_at IS NOT NULL AND paid_at = NEW.order_paid_at.
- سجّل النتيجة في DECISIONS.md.

1. ترحيل 20261125090000_product_kind_addon: ALTER TYPE product_kind ADD VALUE 'addon'; وحده.

2. ترحيل 20261125090100_commerce: الملف المولَّد ثم SQL يدوي في آخره، بالترتيب التالي:

- CREATE SEQUENCE order_reference_seq قبل CREATE TABLE orders. reference في Prisma: @default(dbgenerated("('MSR-'::text || lpad((nextval('order_reference_seq'::regclass))::text, 7, '0'::text))")).
- clubs:
  - UPDATE clubs SET vat_rate_bps = 1500 قبل SET NOT NULL.
  - تعليق يشير إلى SECURITY.md.
  - CHECK vat 0..10000، و CHECK window > 0.
- كل قيود CHECK المذكورة بأسماء ثابتة (<table>\_<rule>). اسم قيد حد الكوبون promotion_redemption_limit يُرفع من T4 بـERRCODE check_violation و CONSTRAINT = 'promotion_redemption_limit'.
- الدوال T1..T7 بـplpgsql:
  - كل دالة ≤ 40 سطرًا.
  - كل رسالة استثناء نص ثابت قابل للمطابقة (مثل 'order_snapshot_immutable').
  - T3 بـCREATE CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED FOR EACH ROW على الجداول الثلاثة. يفحص الطلب المعني (NEW.id أو NEW.order_id).
  - T2 يقارن to_jsonb(NEW) - ARRAY['status','paid_at','paid_provider','paid_provider_payment_id','paid_amount_minor','paid_currency','fulfilled_at','expired_at','cancelled_at'] مع نظيرها من OLD.
  - T5b يتعامل مع TG_OP ومع تغيّر version_id.
- لا فهارس جزئية.
- تحقق في النهاية أن prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --shadow-database-url … --exit-code لا يرى فرقًا.

3. الاختبارات القائمة:

- client.integration.test.ts و catalog.integration.test.ts: أضف vatRateBps: 1500 إلى club.create (قيمة اختبار بثابت مسمّى).
- cleanup في اختبار الكتالوج يبقى يعمل لأن نسخه غير مباعة. لا تغيّر سلوكه المختبَر.

4. test-support/reset-database.ts:

- export async function resetCommerceTables(db: Db): Promise<void>.
- يرمي Error إن لم ينتهِ current_database() بـ_test.
- ثم TRUNCATE audit_logs, refunds, memberships, order_discounts, order_items, orders, assessment_requests, promotion_products, promotions, product_addons, customers RESTART IDENTITY CASCADE (بلا جداول الكتالوج والأندية).
- يحذف بعده بيانات الكتالوج التابعة لأندية الاختبار فقط بنمط الملفات القائمة.

5. test-support/commerce-fixtures.ts:

- مساعدات إدراج خام: createTestClub(policy overrides)، createPlan، createAddon (مع رابط product_addons)، createDigitalProgram، createAssessedService، createPromotion، insertRawOrder.
- insertRawOrder يدرج طلبًا وسطوره بأرقام صحيحة محسوبة يدويًا، لاختبار القيود مباشرة دون الاعتماد على كود WP6.

6. seed-demo.ts:

- لا deleteMany للنسخ: «أنشئ النسخة إن لم توجد بنفس valid_from».
- club.upsert يضبط vatRateBps، وقيمًا تجريبية معلَّمة في تعليق «تجريبي، ليس قرار المالك»: orderPaymentWindowMinutes = 30 و membershipStartRule = 'on_payment'. هذا لأن seed-demo لا يُشغَّل إلا بـSEED_DEMO_DATA=yes.
- إضافة تجريبية واحدة (kind addon) مربوطة بكل الباقات.
- كوبون تجريبي واحد DEMO10 (10%، anyone، all_products، بلا حد).
- عرض بحد استخدام واحد للاختبار الطرفي، معلَّم تجريبيًا.
- تشغيل البذرة مرتين متتاليتين ينجح.

7. commerce-schema.integration.test.ts و commerce-guards.integration.test.ts (كل ملف < 300 سطر، دوال < 60):

- كل بند «تكامل — قيود القاعدة» في خطة الاختبار، بـ$executeRaw، والتحقق بأسماء القيود أو رسائل الاستثناء الثابتة.
- تطابق نتيجة make_interval مع حالات حدّية مكتوبة يدويًا (31 يناير، 29 فبراير). المقارنة مع addMonthsClamped نفسها في WP6.
- prisma migrate diff فارغ: إن تعذّر تشغيله داخل vitest، أضف خطوة موثقة في TESTING عبر DECISIONS (لا تعدّل CI هنا).

8. الوثائق:

- DATABASE_SCHEMA.md: جداول المرحلة 3 الفعلية، و INTEGER بدل BIGINT، والقيود والـtriggers، وجدول الثوابت.
- DECISIONS.md: قرارات جديدة مرقّمة بعد 24:
  - INTEGER للمال وحدوده.
  - الطلب لقطة لا تتغير، والتسوية على صف الطلب.
  - الاستخدام = سطر الخصم.
  - expired نهائي، ولا دفع متأخر يحييه.
  - السياسات أعمدة NULL تمنع.
  - جداول الانتقالات في المجال فقط.
  - نتيجة بوابة Prisma.
  - btree_gist مثبَّت، وتأجيل منع التراكب سببه قاعدة التجديد.
  - اصطلاح الأشهر المقصوص.

تعريف الانتهاء: pnpm db:migrate على قاعدة نظيفة، ثم pnpm test:integration ينجح (القائمة والجديدة)، و typecheck و lint نظيفان.

### WP2 — المجال: التقريب والضريبة والكوبون والعروض والسلة والتسعير (الموجة 1)

**الملفات:** `packages/domain/src/commerce/pricing/limits.ts`، `packages/domain/src/commerce/pricing/rounding.ts`، `packages/domain/src/commerce/pricing/rounding.test.ts`، `packages/domain/src/commerce/pricing/vat.ts`، `packages/domain/src/commerce/pricing/vat.test.ts`، `packages/domain/src/commerce/pricing/coupon-code.ts`، `packages/domain/src/commerce/pricing/coupon-code.test.ts`، `packages/domain/src/commerce/pricing/promotion.ts`، `packages/domain/src/commerce/pricing/promotion.test.ts`، `packages/domain/src/commerce/pricing/cart.ts`، `packages/domain/src/commerce/pricing/cart.test.ts`، `packages/domain/src/commerce/pricing/price-cart.ts`، `packages/domain/src/commerce/pricing/apply-promotion.ts`، `packages/domain/src/commerce/pricing/price-cart.test.ts`، `packages/domain/src/commerce/pricing/index.ts`

قواعد عامة:

- TypeScript خالص. يستورد فقط من ../../money و ../../errors و ../../result و ../../catalog/membership-plan (LocalizedText). لا تعدّل packages/domain/src/index.ts، فالتصدير عبر pricing/index.ts فقط.
- أخطاء العمل Result<\_, DomainError>، وخرق الثوابت throw DomainError('invariant').

limits.ts:

- MAX_AMOUNT_MINOR = 2_147_483_647 (تعليق: حد int4، حد تقني).
- MAX_ADDONS_PER_ORDER = 5.
- BASIS_POINTS_SCALE = 10_000.

rounding.ts:

- mulDivHalfUp(amount: number, numerator: number, denominator: number): number = floor((2an + d)/(2d)) بـBigInt. يرمي invariant لغير الصحيح أو السالب أو d ≤ 0 أو ناتج غير آمن.
- allocateByLargestRemainder(total: number, weights: readonly number[]): readonly number[]: الحصص floor(total·w_i/W) بـBigInt، والباقي واحدًا واحدًا بترتيب الباقي الأكبر ثم الفهرس الأصغر. W = 0 مع total > 0 خطأ invariant. يضمن Σ = total، و share_i ≤ w_i متى total ≤ W.

vat.ts:

- type BasisPoints (علامة)، و basisPoints(value): BasisPoints (عدد صحيح 0..10000 وإلا invariant).
- vatIncludedIn(gross: Money, rate: BasisPoints): Money = mulDivHalfUp(gross, rate, 10000 + rate).

coupon-code.ts:

- type CouponCode (علامة).
- parseCouponCode(input: string): Result<CouponCode | null, DomainError>:
  - الفارغ بعد التنظيف ⇒ ok(null).
  - التنظيف: إزالة \p{Cf} والمسافات، وتحويل الأرقام العربية الهندية والفارسية، و toUpperCase.
  - ثم ^[A-Z0-9]{3,32}$، وإلا validation 'coupon.invalid_format' بالحقل coupon.

promotion.ts:

- PromotionRule = { id; code: CouponCode | null; name: LocalizedText; status: 'draft'|'active'|'archived'; discount: { kind:'percentage'; rate: BasisPoints } | { kind:'fixed_amount'; amount: Money }; audience: 'anyone'|'new_customer'|'existing_customer'; scope: { kind:'all_products' } | { kind:'listed_products'; productIds: readonly string[] }; stackable: boolean; startsAt: Date; endsAt: Date | null; maxRedemptions: number | null; maxRedemptionsPerCustomer: number | null }.
- PromotionCandidate = { rule; usage: { total: number; byCustomer: number } }.
- CustomerStanding = 'new' | 'existing' | 'unknown'.
- checkPromotion(candidate, productIds: readonly string[], ctx: { now: Date; standing: CustomerStanding }): Result<true, DomainError>:
  - ترتيب الفحص: status ⇒ 'promotion.inactive'؛ now < startsAt ⇒ 'promotion.not_started'؛ endsAt ≤ now ⇒ 'promotion.ended'؛ لا تقاطع مع النطاق ⇒ 'promotion.not_applicable'.
  - ثم standing unknown مع audience ≠ anyone أو مع حد عميل ⇒ 'promotion.audience_unverified'. ثم الجمهور ⇒ 'promotion.audience_mismatch'.
  - ثم usage.total ≥ max ⇒ 'promotion.exhausted'، و byCustomer ≥ perCustomer ⇒ 'promotion.customer_limit_reached'.
  - الصنف conflict.

cart.ts:

- PurchasableKind = 'membership' | 'digital_program' | 'addon'.
- CartLine = { productId; versionId; kind: PurchasableKind; slug; name: LocalizedText; summary: LocalizedText; benefits: readonly LocalizedText[]; listPrice: Money; paidMonths: number | null; bonusMonths: number; sortOrder: number }.
- validateCart({ primary: CartLine; addons: readonly CartLine[]; attachableAddonProductIds: readonly string[] }): Result<readonly CartLine[], DomainError>. الأخطاء:
  - primary.kind addon ⇒ validation 'cart.addon_requires_membership'.
  - addons مع primary غير membership ⇒ نفس الخطأ.
  - غير مرتبطة ⇒ 'cart.addon_not_attachable'.
  - مكررة ⇒ 'cart.addon_duplicate'.
  - أكثر من MAX_ADDONS_PER_ORDER ⇒ 'cart.too_many_addons'.
  - عملة مختلفة ⇒ invariant.
  - membership بلا paidMonths ⇒ invariant.
- الناتج مرتب: الأساسي ثم الإضافات بـ(sortOrder, slug).

price-cart.ts و apply-promotion.ts (الخوارزمية في قسم «محرك التسعير» حرفيًا):

- priceCart(input: { lines: readonly CartLine[]; automatic: readonly PromotionCandidate[]; coupon: PromotionCandidate | null; vatRate: BasisPoints; now: Date; standing: CustomerStanding }): Result<PricedCart, DomainError>.
- PricedCart = { currency; vatRate; lines: readonly PricedLine[]; discounts: readonly AppliedDiscount[]; couponOutcome: { kind:'none' } | { kind:'applied' } | { kind:'not_combinable' } | { kind:'rejected'; error: DomainError }; rejectedAutomatic: readonly { promotionId: string; reason: string }[]; subtotal; discount; total; vat; net: Money }.
- PricedLine = CartLine & { position; discount; total; vat; net: Money }.
- AppliedDiscount = { promotionId; source:'automatic'|'coupon'; code: CouponCode | null; name; discountRule: PromotionRule['discount']; sequence: 1|2; amount: Money }.
- التعادل بين التلقائيين: الأقدم startsAt ثم id الأصغر. التعادل بين تلقائي وكوبون غير قابلين للتراكم: التلقائي.
- subtotal > MAX_AMOUNT_MINOR ⇒ validation 'cart.amount_out_of_range'. total = 0 ⇒ validation 'cart.zero_total'.
- قبل الإرجاع تُفحص الثوابت (المجاميع، لا سالب) وإلا invariant.

الاختبارات:

- كل بنود «وحدة — المجال (التسعير)» في خطة الاختبار.
- الأمثلة 1-4 بأرقامها الحرفية: 19552/130348؛ 12488/11402/5870/17272؛ 5827/2504/1669 و3792/1630/1087/6509؛ وفي المثال 4: الافتراضي 134910/17597، والتراكم 3332/1668 و11293/5652 و129910/16945.
- اختبار خصائص ببذرة ثابتة (مولّد بسيط داخل الاختبار، بلا اعتمادية).

pricing/index.ts يصدّر كل الأنواع والدوال العامة أعلاه.

### WP3 — المجال: آلات الحالة والتسوية والتواريخ والاشتراك والمشتري وبصمة الطلب (الموجة 1)

**الملفات:** `packages/domain/src/commerce/lifecycle/state-machine.ts`، `packages/domain/src/commerce/lifecycle/state-machine.test.ts`، `packages/domain/src/commerce/lifecycle/open-policies.ts`، `packages/domain/src/commerce/lifecycle/order-state.ts`، `packages/domain/src/commerce/lifecycle/order-state.test.ts`، `packages/domain/src/commerce/lifecycle/settlement.ts`، `packages/domain/src/commerce/lifecycle/settlement.test.ts`، `packages/domain/src/commerce/lifecycle/plain-date.ts`، `packages/domain/src/commerce/lifecycle/plain-date.test.ts`، `packages/domain/src/commerce/lifecycle/membership-period.ts`، `packages/domain/src/commerce/lifecycle/membership-period.test.ts`، `packages/domain/src/commerce/lifecycle/membership-state.ts`، `packages/domain/src/commerce/lifecycle/membership-state.test.ts`، `packages/domain/src/commerce/lifecycle/refund-state.ts`، `packages/domain/src/commerce/lifecycle/refund-state.test.ts`، `packages/domain/src/commerce/lifecycle/buyer.ts`، `packages/domain/src/commerce/lifecycle/buyer.test.ts`، `packages/domain/src/commerce/lifecycle/order-request.ts`، `packages/domain/src/commerce/lifecycle/order-request.test.ts`، `packages/domain/src/commerce/lifecycle/index.ts`

قواعد عامة:

- TypeScript خالص. يستورد من ../../money و ../../errors و ../../result و ../../saudi-mobile فقط، ولا شيء من pricing.
- لا تعدّل packages/domain/src/index.ts، والتصدير عبر lifecycle/index.ts.

open-policies.ts:

- OPEN_POLICIES = ['freeze_rules','cancellation_rules','refund_eligibility','renewal_start'] as const؛ type OpenPolicy.

state-machine.ts:

- interface Transition<S extends string, E extends string> { from: S; event: E; to: S; blockedBy?: OpenPolicy }.
- nextState<S, E>(machine: string, table: readonly Transition<S,E>[], from: S, event: E): Result<S, DomainError>:
  - غير موجود ⇒ conflict `${machine}.invalid_transition`.
  - محجوب ⇒ conflict `policy.undecided.${blockedBy}`.

order-state.ts:

- ORDER_STATUSES (7 بترتيب enum القاعدة)، و type OrderStatus.
- OrderEvent = 'payment_verified'|'expire'|'cancel'|'fulfil'|'refund_partial'|'refund_full'.
- ORDER_TRANSITIONS حسب جدول «آلات الحالة» (الاسترداد محجوب refund_eligibility)، و nextOrderStatus(from, event).
- TERMINAL_ORDER_STATUSES.
- effectiveOrderStatus(status, expiresAt: Date, now: Date): OrderStatus (pending ومعه now ≥ expiresAt ⇒ expired).
- orderExpiry(createdAt: Date, windowMinutes: number): Date (يرمي invariant لغير الصحيح الموجب).

settlement.ts:

- VerifiedPayment = { provider: string; providerPaymentId: string; amountMinor: number; currency: string } (خام من المزوّد).
- SettleableOrder = { status: OrderStatus; total: Money; paid: { provider; providerPaymentId } | null }.
- decideSettlement(order, payment): Result<'apply'|'replay', DomainError>. الترتيب:
  1. paid غير null ومطابق ⇒ ok('replay').
  2. paid غير null ⇒ conflict 'order.already_paid'.
  3. status ليس pending_payment ⇒ conflict 'order.not_payable'.
  4. العملة ⇒ conflict 'payment.currency_mismatch'.
  5. المبلغ ⇒ conflict 'payment.amount_mismatch'.
  6. وإلا ok('apply').
- provider يطابق ^[a-z][a-z0-9_]{1,31}$ و providerPaymentId 1..200 محرف، وإلا validation 'payment.invalid_reference'.

plain-date.ts:

- PlainDate { year; month; day }.
- plainDateInZone(instant: Date, timeZone: string) عبر Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).
- addMonthsClamped(date, months): أشهر ميلادية مع قصّ آخر الشهر، مطابق لـPostgreSQL date + interval.
- formatPlainDate ('YYYY-MM-DD')، و parsePlainDate، و comparePlainDates، و addDays.

membership-period.ts:

- MembershipStartRule = 'on_payment' | 'on_first_visit'.
- membershipPeriod(startsOn, paidMonths, bonusMonths): { startsOn; endsOn } (endsOn حدّ غير مشمول = addMonthsClamped(startsOn, paid+bonus)).
- decideMembershipStart({ rule; paidOn: PlainDate; hasLiveMembership: boolean; paidMonths; bonusMonths }): { status:'active'; startsOn; endsOn } | { status:'scheduled'; reason:'awaiting_first_visit'|'renewal_rule_undecided' }.
- isLiveMembership({ status; endsOn: PlainDate | null }, today): boolean (scheduled أو frozen، أو active مع endsOn > today).

membership-state.ts:

- MEMBERSHIP_STATUSES، و MembershipEvent = 'start_confirmed'|'freeze'|'unfreeze'|'period_ended'|'cancel'.
- MEMBERSHIP_TRANSITIONS حسب الجدول: start_confirmed blockedBy renewal_start؛ freeze/unfreeze blockedBy freeze_rules؛ cancel blockedBy cancellation_rules.
- nextMembershipStatus.
- effectiveMembershipStatus(status, endsOn, today) (active ومعه today ≥ endsOn ⇒ expired).

refund-state.ts:

- REFUND_STATUSES، و RefundEvent = 'request'|'approve'|'reject'|'start'|'complete'|'fail'.
- REFUND_TRANSITIONS: request و approve blockedBy refund_eligibility.
- nextRefundStatus.

buyer.ts:

- BuyerName (علامة).
- parseBuyerName(input): إزالة \p{Cf}، وتوحيد المسافات، وقص الطرفين. الطول 2..120، وحرف واحد على الأقل (\p{L}). الأخطاء validation 'buyer.name_too_short' | 'buyer.name_too_long' | 'buyer.name_invalid' بالحقل name.
- Buyer { name: BuyerName; mobile: SaudiMobile }.
- parseBuyer({ name, mobile }): Result<Buyer, readonly DomainError[]> يجمع خطأ الاسم وخطأ parseSaudiMobile معًا (الحقل mobile).

order-request.ts:

- canonicalOrderRequest({ planSlug; addonSlugs; couponCode: string | null; buyer: Buyer; locale: 'ar'|'en' }): string. يعطي JSON بمفاتيح مرتبة والإضافات مرتبة وبلا تكرار. التجزئة sha256 في طبقة القاعدة.
- replayDecision(stored: string, incoming: string): 'replay' | 'conflict'.
- canonicalAssessmentRequest({ productSlug; buyer; locale }): string.

الاختبارات:

- كل بنود «وحدة — المجال (دورة الحياة)»، ومنها مسح شامل للجداء (حالة × حدث) لكل آلة.
- لا مسار يعود إلى pending_payment، ولا expired→paid.
- plainDateInZone عند 20:59Z و 21:00Z مع Asia/Riyadh.
- addMonthsClamped: 31 يناير +1 = 28 فبراير 2027، و29 فبراير 2028 +12 = 28 فبراير 2029، و30 نوفمبر +14 = 30 يناير.

lifecycle/index.ts يصدّر كل ما سبق.

### WP4 — المجال: سياسة البيع، buildOrderDraft و buildQuote الدالتان الحاكمتان، وطلب التقييم، وتصدير الحزمة (الموجة 2)

**يعتمد على:** WP2، WP3

**الملفات:** `packages/domain/src/commerce/checkout/commerce-policy.ts`، `packages/domain/src/commerce/checkout/commerce-policy.test.ts`، `packages/domain/src/commerce/checkout/order-draft.ts`، `packages/domain/src/commerce/checkout/order-draft.test.ts`، `packages/domain/src/commerce/checkout/quote.ts`، `packages/domain/src/commerce/checkout/quote.test.ts`، `packages/domain/src/commerce/checkout/assessment.ts`، `packages/domain/src/commerce/checkout/assessment.test.ts`، `packages/domain/src/commerce/checkout/index.ts`، `packages/domain/src/index.ts`

يعتمد على pricing/index.ts و lifecycle/index.ts.

commerce-policy.ts:

- CommercePolicy { vatRate: BasisPoints; currency: Currency; timeZone: string; orderPaymentWindowMinutes: number | null; membershipStartRule: MembershipStartRule | null }.
- UndecidedPolicy = 'order_payment_window' | 'membership_start_rule'.
- checkoutBlockers(policy, primaryKind: 'membership'|'digital_program'): readonly UndecidedPolicy[]. قاعدة البدء تُطلب لطلبات الاشتراك فقط.
- blockerError(blockers): DomainError conflict 'policy.undecided.<first>'.

order-draft.ts:

- OrderFacts = { primary: CartLine; addons: readonly CartLine[]; attachableAddonProductIds: readonly string[]; policy: CommercePolicy; automatic: readonly PromotionCandidate[]; coupon: { kind:'none' } | { kind:'unknown_code'; code: CouponCode } | { kind:'found'; candidate: PromotionCandidate }; customer: { standing: 'new'|'existing'; pendingOrders: number }; maxPendingOrders: number; buyer: Buyer; locale: 'ar'|'en'; now: Date }.
- buildOrderDraft(facts): Result<OrderDraft, DomainError>. الترتيب:
  1. checkoutBlockers.
  2. validateCart.
  3. pendingOrders ≥ max ⇒ conflict 'order.too_many_pending'.
  4. unknown_code ⇒ not_found 'coupon.unknown' بالحقل coupon.
  5. priceCart بالمكانة الحقيقية. couponOutcome rejected ⇒ يرجع خطأه نفسه بصنف validation وحقل coupon (لا تجاهل صامت). not_combinable ⇒ يُقبل ويُذكر في draft.couponOutcome.
  6. expiresAt = orderExpiry(now, window).
- OrderDraft = { buyer; locale; currency; vatRate; items: readonly OrderItemDraft[] (position, kind, productId, versionId, slug, name, summary, benefits, paidMonths, bonusMonths, membershipStartRule: الختم للاشتراك وإلا null، listPrice, discount, total, vat); discounts: readonly AppliedDiscount[]; subtotal; discount; total; vat; expiresAt; couponOutcome }.
- هي الدالة الوحيدة التي تقرر ما يُكتب، وطبقة القاعدة تكتب OrderDraft حرفيًا.

quote.ts:

- buildQuote(facts without buyer/customer/maxPendingOrders/locale): Result<Quote, DomainError>.
- Quote = PricedCart + { blockers: readonly UndecidedPolicy[]; couponError: DomainError | null; membershipStartRule }.
- المكانة unknown. الـblockers لا تُرجع خطأً هنا بل تُعرض، فالصفحة تقرر «غير متاح».

assessment.ts:

- validateAssessmentRequest({ product: { kind: string; status: string } | undefined }): Result<true, DomainError>.
- not_found 'assessment.product_unavailable' ما لم يكن assessed_service فعّالًا.

checkout/index.ts. وعدّل packages/domain/src/index.ts ليصدّر pricing و lifecycle و checkout مع الإبقاء على الصادرات القائمة.

الاختبارات: بنود «وحدة — المجال (التجميع)»:

- كل سياسة NULL.
- الكوبون المرفوض على حقل coupon.
- اللقطة تحمل الاسم والمدة والمزايا والسعر وقاعدة البدء المختومة.
- too_many_pending.
- عرض new_customer يُطبَّق بالمكانة الحقيقية ويُعلَّم audience_unverified في buildQuote.
- not_combinable لا يمنع الإنشاء.
- البرنامج الرقمي لا يحتاج قاعدة البدء.

### WP5 — الويب: علم CHECKOUT_ENABLED وحمايته ونقطة دخول زر الشراء (الموجة 2)

**الملفات:** `apps/web/src/server/env/parse-env.ts`، `apps/web/src/server/env/parse-env.test.ts`، `apps/web/src/server/checkout/flag.ts`، `apps/web/src/server/checkout/flag.test.ts`، `apps/web/src/config/checkout.ts`، `apps/web/src/components/plans/plan-paths.ts`، `apps/web/src/components/plans/plan-paths.test.ts`، `apps/web/src/components/plans/plan-summary.tsx`، `apps/web/src/components/plans/plan-shop.tsx`، `apps/web/src/app/[locale]/memberships/[slug]/page.tsx`، `apps/web/src/i18n/dictionaries/ar.ts`، `apps/web/src/i18n/dictionaries/en.ts`، `.env.example`

parse-env.ts:

- أضف CHECKOUT_ENABLED: z.string().optional().transform(v => v === 'true').
- أضف refine: إن كان NODE_ENV === 'production' و CHECKOUT_ENABLED، فيجب أن يكون hostname لـSITE_URL ضمن LOOPBACK_HOSTS. path ['CHECKOUT_ENABLED']، والخطأ 'must stay off in production until payments exist'.
- ServerEnv يحمل CHECKOUT_ENABLED: boolean.
- اختبارات: الغياب و 'TRUE' و '1' تعني مغلق؛ 'true' مفتوح في development؛ production + https عام + true مرفوض؛ production + 127.0.0.1 + true مقبول.

flag.ts (import 'server-only'):

- isCheckoutEnabled(): boolean من getEnv().
- requireCheckout(): void، يستدعي notFound() من next/navigation إن كان مغلقًا.
- flag.test.ts بالـstub القائم لـserver-only ومحاكاة next/navigation.

config/checkout.ts (ثوابت تقنية لا سياسات عمل، كل منها بتعليق):

- MAX_PENDING_ORDERS_PER_CUSTOMER = 3.
- MAX_NAME_INPUT_LENGTH = 200، و MAX_MOBILE_INPUT_LENGTH = 32، و MAX_COUPON_INPUT_LENGTH = 64.

plan-paths.ts:

- أضف purchaseHref(plan, locale, dictionary, checkoutEnabled: boolean): { href: string; external: boolean }.
- مفتوح ⇒ localizedPath(locale, `/checkout/${plan.slug}`)، external false. مغلق ⇒ purchaseUrl الحالي.
- plan-paths.test.ts للحالتين.

plan-summary.tsx و plan-shop.tsx:

- prop جديدة checkoutEnabled: boolean تمرّ من الصفحة إلى PlanSummary و StickyPurchaseBar.
- مفتوح: الزر الأساسي «اشترِ الآن» إلى صفحة البيانات، وتحته رابط نصي ثانوي إلى واتساب.
- مغلق: السلوك الحالي بلا أي تغيير مرئي.

memberships/[slug]/page.tsx: يستدعي isCheckoutEnabled() ويمرّره.

القواميس: أضف plan.buyOnline و plan.whatsappAlternative باللغتين، والعربي المرجع.

.env.example: CHECKOUT_ENABLED= مع تعليق أنه مغلق افتراضيًا ومرفوض في الإنتاج.

لا صفحات checkout في هذه الحزمة: الرابط يظهر فقط والعلم مفتوح، والعلم مغلق افتراضيًا.

التحقق: pnpm lint و typecheck و test، و e2e الحالية تبقى ناجحة بلا تعديل.

### WP6 — طبقة القاعدة: الأقفال وجمع الحقائق والعرض والإنشاء والتسوية والإنهاء والقراءة وطلب التقييم (الموجة 3)

**يعتمد على:** WP1، WP4

**الملفات:** `packages/db/src/commerce/sql-errors.ts`، `packages/db/src/commerce/locks.ts`، `packages/db/src/commerce/load-catalog.ts`، `packages/db/src/commerce/load-promotions.ts`، `packages/db/src/commerce/load-customer.ts`، `packages/db/src/commerce/policy.ts`، `packages/db/src/commerce/audit.ts`، `packages/db/src/commerce/quote.ts`، `packages/db/src/commerce/create-order.ts`، `packages/db/src/commerce/write-order.ts`، `packages/db/src/commerce/mark-order-paid.ts`، `packages/db/src/commerce/expire-orders.ts`، `packages/db/src/commerce/read-order.ts`، `packages/db/src/commerce/assessment.ts`، `packages/db/src/commerce/index.ts`، `packages/db/src/index.ts`، `packages/db/prisma/expire-orders.ts`، `packages/db/package.json`، `packages/db/src/commerce-sql-errors.integration.test.ts`، `packages/db/src/commerce-create-order.integration.test.ts`، `packages/db/src/commerce-concurrency.integration.test.ts`، `packages/db/src/commerce-mark-paid.integration.test.ts`، `packages/db/src/commerce-expiry-assessment.integration.test.ts`

قاعدة الطبقة: ترجمة فقط، بلا قرار عمل. تجمع الحقائق تحت الأقفال، وتستدعي دالة المجال، وتكتب ناتجها حرفيًا.

- المعاملات db.$transaction(fn, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 }) بثوابت مسمّاة.
- الأقفال بـtx.$queryRaw، وترتيبها حسب قسم «المعاملات والتزامن» حرفيًا.
- خطأ العمل داخل المعاملة يُرمى ككائن خاص (class AbortWith { error }) ثم يُحوَّل إلى Result خارجها.

sql-errors.ts:

- constraintName(error: unknown): string | undefined، يقرأ اسم القيد من خطأ محوّل Prisma 7 (P2002 meta، أو خطأ PG الأصلي في cause، أو رسالة trigger الثابتة).
- isUniqueViolation(error, constraint).
- mapCommerceDbError(error): DomainError | undefined:
  - orders_idempotency_key_key ⇒ 'order.idempotency_retry' (داخلي، يعيد القراءة).
  - orders_paid_provider_paid_provider_payment_id_key ⇒ conflict 'payment.already_used'.
  - promotion_redemption_limit ⇒ conflict 'promotion.exhausted'.
  - ما عدا ذلك undefined، فيبقى عطلًا 500.

locks.ts:

- lockIdempotencyKey(tx, key): pg_advisory_xact_lock(hashtextextended($1::text, 0)).
- ensureCustomerLocked(tx, clubId, phone): Promise<string>، أي INSERT … ON CONFLICT DO NOTHING ثم SELECT id … FOR UPDATE.
- lockVersionsForShare(tx, ids) (مرتبة، FOR SHARE).
- lockPromotions(tx, ids) (ORDER BY id FOR UPDATE).

load-catalog.ts: loadCartLines(tx|db, { planSlug, addonSlugs, now }) يرجع:

- primary: CartLine، والنادي، ومعرّفات الإضافات المرتبطة من product_addons.
- المنتج غير active، أو بلا نسخة سارية، أو نوعه assessed_service ⇒ not_found 'cart.product_unavailable'.
- المزايا تُقرأ في دالة منفصلة loadBenefits(tx, versionIds) تُستدعى بعد القفل.

load-promotions.ts:

- loadCandidateIds(tx, clubId, productIds, code, now): التلقائية الفعّالة السارية المتقاطعة، والكوبون بالرمز.
- loadPromotionCandidates(tx, ids, customerId | null): القاعدة + usage { total, byCustomer } من order_discounts JOIN orders حيث status NOT IN ('expired','cancelled').

load-customer.ts:

- loadStanding(tx, customerId): new | existing (وجود طلب paid_at غير فارغ).
- countPendingOrders(tx, customerId, now).
- hasLiveMembership(tx, customerId, today) بتعريف isLiveMembership.

policy.ts: loadCommercePolicy(tx, clubId) يرجع CommercePolicy من clubs (vat_rate_bps, currency, timezone, window, start rule).

audit.ts: writeAudit(tx, entry) بلا جوال ولا اسم في data.

quote.ts: quoteCart(db, { planSlug; addonSlugs; couponCode: CouponCode | null }, now): Promise<Result<Quote, DomainError>>. قراءة فقط بلا أقفال، عبر buildQuote.

create-order.ts و write-order.ts:

- createOrder(db, input: CreateOrderInput): Promise<Result<{ orderId; reference; publicToken; replayed: boolean }, DomainError>>.
- CreateOrderInput = { planSlug; addonSlugs; couponCode: CouponCode | null; buyer: Buyer; locale; idempotencyKey; publicToken; quotedTotalMinor; maxPendingOrders; now }.
- البصمة sha256(canonicalOrderRequest) بـnode:crypto.
- الخطوات 1-12 بالترتيب الحرفي في قسم createOrder. cart.price_changed يحمل الإجمالي الجديد في DomainError بحقل cause = { totalMinor }.
- write-order.ts: insertOrderDraft(tx, draft, ids) يكتب orders ثم order_items ثم order_discounts ثم audit_logs.
- خطأ فريد على المفتاح خارج المعاملة ⇒ إعادة القراءة.

mark-order-paid.ts (نقطة تسليم المرحلة 4، وتعليق رأس الملف يذكر الشرطين الصلبين):

- markOrderPaid(db, { orderId; payment: VerifiedPayment; actor: 'provider'|'system'; now }): Promise<Result<{ orderId; reference; status:'paid'|'fulfilled'; membershipId: string | null; replayed: boolean }, DomainError>>.
- الخطوات 1-7 حرفيًا.
- paidOn = plainDateInZone(now, club.timezone). starts_on و ends_on تُكتب نصوص YYYY-MM-DD.

expire-orders.ts: expireDueOrders(db|tx, { now; limit; customerId?; promotionIds? }): Promise<number>، جملة UPDATE … FOR UPDATE SKIP LOCKED مع CTE للتدقيق.

read-order.ts: findOrderByPublicToken(db, token): Promise<OrderView | undefined>. من اللقطة فقط، لا join على الكتالوج. effectiveStatus بـeffectiveOrderStatus، والجوال مقنَّع (آخر رقمين).

assessment.ts: createAssessmentRequest(db, { productSlug; buyer; locale; idempotencyKey; now }): Promise<Result<{ id; replayed }, DomainError>>. قفل استشاري، ثم عميل، ثم مفتاح وبصمة، ثم validateAssessmentRequest، ثم INSERT وتدقيق.

prisma/expire-orders.ts: سكربت يقرأ DATABASE_URL، ويستدعي expireDueOrders بدفعات من 500 حتى يرجع صفرًا، ويطبع العدد. package.json: "orders:expire": "tsx prisma/expire-orders.ts".

packages/db/src/index.ts: صدّر الدوال والأنواع العامة.

الاختبارات (resetCommerceTables و commerce-fixtures من WP1، والتزامن بـPromise.all على عملاء Db منفصلين):

- كل بنود «تكامل — المستودعات».
- isUniqueViolation على خطأ حقيقي.
- تطابق addMonthsClamped مع make_interval لألف مدخل مولّد ببذرة ثابتة.
- كل ملف < 300 سطر.

### WP7 — الويب: صفحات الشراء ونموذج البيانات والإجراء وصفحة مراجعة الطلب واختبارات المتصفح (الموجة 4)

**يعتمد على:** WP5، WP6

**الملفات:** `apps/web/src/server/checkout/quote.ts`، `apps/web/src/server/checkout/place-order.ts`، `apps/web/src/server/checkout/order-view.ts`، `apps/web/src/server/checkout/form-schema.ts`، `apps/web/src/server/checkout/form-schema.test.ts`، `apps/web/src/server/checkout/actions.ts`، `apps/web/src/server/checkout/actions.test.ts`، `apps/web/src/app/[locale]/checkout/[slug]/page.tsx`، `apps/web/src/app/[locale]/checkout/orders/[token]/page.tsx`، `apps/web/src/components/checkout/quote-summary.tsx`، `apps/web/src/components/checkout/options-form.tsx`، `apps/web/src/components/checkout/details-form.tsx`، `apps/web/src/components/checkout/order-review.tsx`، `apps/web/src/components/checkout/unavailable-notice.tsx`، `apps/web/src/components/checkout/error-text.ts`، `apps/web/src/i18n/dictionaries/ar.ts`، `apps/web/src/i18n/dictionaries/en.ts`، `apps/web/e2e/checkout.spec.ts`، `apps/web/e2e/checkout-off.spec.ts`، `apps/web/playwright.config.ts`

قبل الكتابة: اقرأ node_modules/next/dist/docs/01-app/02-guides/server-actions.md و forms.md، ثم اتبع اصطلاح Next 16 (useActionState، redirect، notFound، searchParams كـPromise).

server/checkout (كله import 'server-only'):

- quote.ts: getCheckoutQuote({ slug; addonSlugs; couponInput }). يستدعي parseCouponCode ثم quoteCart(getDb(), …, new Date()) ويسجّل أعطال القاعدة منقّحة بنمط server/catalog.ts.
- place-order.ts: placeOrder(input) يولّد publicToken بـrandomBytes(32).toString('base64url') ويستدعي createOrder بـMAX_PENDING_ORDERS_PER_CUSTOMER.
- order-view.ts: getOrderView(token). الرمز يجب أن يطابق ^[A-Za-z0-9_-]{43}$ وإلا undefined.
- form-schema.ts: مخطط zod (name و mobile بأطوال config، و idempotencyKey uuid، و quotedTotalMinor عدد صحيح ≥ 0، و addons مصفوفة ≤ MAX_ADDONS_PER_ORDER، و coupon، و locale، و slug بنمط slug القائم).
- actions.ts ('use server'): submitCheckout(prev: CheckoutFormState, formData): Promise<CheckoutFormState>.
  - أول سطر requireCheckout().
  - ثم المخطط، ثم parseBuyer (كل الأخطاء) و parseCouponCode، ثم placeOrder، ثم redirect(localizedPath(locale, `/checkout/orders/${token}`)).
  - CheckoutFormState = { values: { name; mobile }; errors: Partial<Record<'name'|'mobile'|'coupon'|'form', string>> (مفاتيح أسباب)؛ idempotencyKey: string; quotedTotalMinor: number; notice: 'price_changed' | 'data_changed' | null }.
  - price_changed ⇒ quotedTotalMinor = الإجمالي الجديد من cause، ومفتاح جديد. idempotency_key_reused ⇒ مفتاح جديد. هذا يمنع حلقة السعر.
- actions.test.ts: العلم مغلق ⇒ notFound ولا نداء لـplaceOrder (محاكاة)، وتحويل كل سبب إلى حالة النموذج.

الصفحات (generateMetadata بـrobots noindex، ديناميكية):

- checkout/[slug]/page.tsx:
  - requireCheckout و isLocale، ثم getCheckoutQuote. not_found ⇒ notFound().
  - blockers غير فارغة ⇒ UnavailableNotice (واتساب) بلا نموذج.
  - وإلا QuoteSummary و OptionsForm (GET، خانات الإضافات وحقل الكوبون، خادمي) و DetailsForm بمفتاح crypto.randomUUID() والإجمالي المعروض.
- checkout/orders/[token]/page.tsx: requireCheckout ثم getOrderView ⇒ OrderReview. غير موجود ⇒ notFound().

المكوّنات:

- details-form.tsx: 'use client' وحده.
  - الاسم autocomplete=name؛ الجوال inputMode=tel و autoComplete=tel و dir=ltr.
  - أخطاء بجانب الحقول بـaria-describedby، وزر إرسال يُعطَّل أثناء الانتظار.
  - يعمل بلا JavaScript.
- order-review.tsx: المرجع، والسطور، والمزايا، والخصومات، و«منه ضريبة القيمة المضافة»، وقاعدة البدء المختومة، والمهلة بتوقيت النادي (format القائم).
  - نص «الدفع الإلكتروني غير متاح بعد» ورابط واتساب برسالة تحمل المرجع (whatsappUrl).
  - طلب منتهٍ ⇒ رسالة ورابط إلى /checkout/<slug>.
  - لا زر دفع.
- error-text.ts: دالة تحوّل سبب DomainError إلى نص القاموس، عبر Record مضبوط بالأنواع على قائمة الأسباب المعروفة.

القواميس: قسم checkout كامل باللغتين، والعربي المرجع. لا نص عن استرداد أو إلغاء.

playwright.config.ts:

- webServer مصفوفة: الخادم القائم على 3100 كما هو، وخادم ثانٍ على 3101 مع CHECKOUT_ENABLED=true و SITE_URL 127.0.0.1:3101.
- مشروع checkout (testMatch checkout.spec.ts، baseURL 3101) بمقاسي 390 و1440.
- المشاريع القائمة تتجاهل checkout.spec.ts.

e2e:

- checkout-off.spec.ts على 3100: /checkout/<slug> و /en/checkout/<slug> ترجع 404، وزر الباقة رابط wa.me.
- checkout.spec.ts على 3101، بالبذرة التجريبية من WP1:
  - المسار الكامل بالعربية والإنجليزية، والإجمالي متطابق في الخطوات الثلاث.
  - إضافة وكوبون DEMO10.
  - جوال خاطئ.
  - كوبون غير صالح.
  - ضغطتان ⇒ مرجع واحد.
  - JavaScript معطَّل (context javaScriptEnabled: false).
  - لا زر دفع.
  - axe بلا مخالفات.
  - لقطات المقاسات السبعة لصفحتي البيانات والمراجعة، بنمط screens.spec.ts وحفظ اللقطات.

التحقق: سلسلة CLAUDE.md كاملة، ومنها pnpm build && pnpm e2e.

### WP8 — الوثائق: عقد المرحلة 4 وشروطها الصلبة، رحلات المستخدم، والتقدم بدليل التحقق (الموجة 5)

**يعتمد على:** WP6، WP7

**الملفات:** `docs/PAYMENTS.md`، `docs/USER_JOURNEYS.md`، `docs/ARCHITECTURE.md`، `docs/DECISIONS.md`، `docs/PROGRESS.md`

كل الكتابة بالعربية.

PAYMENTS.md: قسم «عقد التسليم من المرحلة 3»:

- توقيع markOrderPaid و VerifiedPayment ونتائجها وأسباب أخطائها.
- الضمانات: مرة واحدة، والقيود الفريدة، وCHECK المبلغ والعملة.
- **شروط صلبة على المرحلة 4 قبل أي دفع حي:**
  1. جلسة المزوّد أو رابط الدفع تنتهي قبل orders.expires_at بهامش يُحدد في المرحلة 4.
  2. expireDueOrders يستثني كل طلب له محاولة دفع pending أو authorized.
  3. markOrderPaid لا تُستدعى إلا بعد قراءة الحالة من المزوّد ومطابقة التاجر والمرجع MSR والمبلغ والعملة.
  4. order.not_payable يُنبّه الإدارة، ومعالجته قرار مالك.
  5. التحقق من الجوال أو تحديد المعدل قبل فتح العلم للعموم.
- التحقق من أن البادئة MSR لا تتعارض مع مراجع الـCRM (القسم 4).

USER_JOURNEYS.md: رحلة الشراء خلف العلم (باقة ← بيانات ← مراجعة)، وحالات الخطأ والاسترجاع كما في التصميم، وأن طلب التقييم بلا واجهة حتى المرحلة 6.

ARCHITECTURE.md: طبقات domain/commerce (pricing، lifecycle، checkout)، و packages/db/src/commerce، و server/checkout، وترتيب الأقفال، وأن الانتهاء لا يعتمد على جدولة (سكربت orders:expire ومؤقت systemd أو cron عند النشر بدل pg-boss لهذه المهمة، تحديثًا للقرار 10).

DECISIONS.md:

- العلم مرفوض في الإنتاج إلا على عنوان الجهاز.
- المكوّن العميل الوحيد useActionState.
- public_token في رابط المراجعة مع تقنيع الجوال.
- MAX_PENDING_ORDERS_PER_CUSTOMER ثابت تقني.
- الإنهاء بلا pg-boss.

PROGRESS.md:

- المرحلة 3 بدليل تحقق مسجَّل: مخرجات pnpm lint و format:check و typecheck و test و test:integration و build و e2e بالأعداد.
- **موانع الإطلاق العام** صراحة: كل سياسات قسم «السياسات غير المحسومة»، وسن القبول، ونص الشروط، والتحقق من الجوال، وشروط المرحلة 4.
- أسئلة المالك المفتوحة.
- بنود المرحلة 2 المفتوحة تبقى كما هي.

## أسئلة للمالك

كل سؤال معه السلوك الآمن المتّبع حتى يُجاب.

1. ما مهلة الطلب غير المدفوع بالدقائق (orders.expires_at)؟ الافتراضي الآمن حتى الحسم: العمود clubs.order_payment_window_minutes فارغ، ولا يُنشأ أي طلب إطلاقًا.
2. متى يبدأ الاشتراك: من تاريخ الدفع أم من أول زيارة؟ الافتراضي الآمن: العمود فارغ، فلا يُنشأ أي طلب اشتراك، وتعرض الصفحة «الشراء الإلكتروني غير متاح» مع واتساب.
3. إذا جدّد عميل اشتراكه وما زال اشتراكه الحالي ساريًا، هل يبدأ الجديد من تاريخ انتهاء القائم أم من تاريخ الدفع؟ الافتراضي الآمن: يُسجَّل الجديد «مجدول» بلا تواريخ، فلا تضيع أيام ولا تتراكب المدتان، ويُضبط البدء يدويًا لاحقًا.
4. ما قواعد التجميد: كم مرة، وأقصى مدة، وهل له رسوم؟ الافتراضي الآمن: لا تجميد من المنصة، ويبقى عبر الـCRM كما اليوم.
5. ما سياسة الإلغاء والاسترداد بعد المراجعة القانونية لقاعدة «لا إلغاء ولا استرداد، التجميد فقط» مقابل نظام التجارة الإلكترونية السعودي؟ الافتراضي الآمن: لا إلغاء ولا استرداد من المنصة، ولا يُعرض للعميل أي نص سياسة.
6. هل تُسمح الترقية من باقة إلى أطول، وكيف يُحسب فرقها؟ الافتراضي الآمن: الترقية غير ممثلة، والشراء الجديد ينتج اشتراكًا مجدولًا لا يمسّ القائم.
7. هل يجتمع العرض التلقائي مع الكوبون في طلب واحد؟ الافتراضي الآمن: لا يجتمعان. يُطبَّق الخصم الأكبر وحده، ولا يُستهلك الكوبون الخاسر، ولا يتراكمان إلا إذا علّم المالك العرضين معًا.
8. ما الحد الأدنى لسن المشترك، وكيف يُتحقق منه؟ الافتراضي الآمن: لا يُجمع عمر، والبيع مغلق بالعلم ومرفوض في الإنتاج حتى الحسم.
9. هل تُعلَّم باقة بأنها «موصى بها»؟ الافتراضي الآمن: لا علامة تسويقية. تبقى الإشارة الوحيدة «الأقل تكلفة شهريًا» المحسوبة (القرار 22).
10. من هو «العميل الجديد» في عروض العملاء الجدد: من لم يشترِ من المنصة، أم من ليس مشتركًا في النادي حسب الـCRM أيضًا؟ الافتراضي الآمن: لا يُنشأ أي عرض مقيَّد بجمهور قبل الحسم. والتعريف التقني الحالي «لا طلب مدفوع على المنصة».
11. إذا وصلت دفعة لطلب انتهت مهلته وكُتب منتهيًا، هل يُفعَّل الاشتراك يدويًا أم تُرد الدفعة؟ الافتراضي الآمن: لا تفعيل آلي، ويُسجَّل الحدث كاملًا في التدقيق، والمرحلة 4 تمنع وقوعه بإنهاء جلسة المزوّد قبل المهلة.
12. ما الإضافات التي تُباع فعلًا مع الاشتراك؟ المواصفات تجعل التدريب الشخصي خدمة بتقييم لا إضافة تُشترى. الافتراضي الآمن: الآلية موجودة، لكن بلا صفوف ربط فلا تُعرض أي إضافة.
13. هل يُقبل طلب بإجمالي صفر (خصم كامل أو هدية)؟ الافتراضي الآمن: مرفوض في القاعدة والمجال، فلا اشتراك بلا دفعة متحقق منها.
14. كيف يُسلَّم البرنامج الرقمي بعد الدفع؟ الافتراضي الآمن: المحرك يدعمه، لكن لا واجهة لشرائه، والطلب الرقمي المدفوع يبقى «مدفوعًا» بلا تسليم.
15. هل يقرّ المالك والمحاسب حساب المدة بأشهر ميلادية تقويمية مع قصّ آخر الشهر (31 يناير + شهر = 28 فبراير)، واعتبار تاريخ الانتهاء أول يوم بعد المدة؟ وهل يقرّان حساب الضريبة لكل سطر بتقريب النصف للأعلى ثم الجمع؟ الافتراضي الآمن: الاصطلاحان معزولان في دالة واحدة مع قيد مطابق في القاعدة، ولا اشتراك يُفعَّل قبل المرحلة 4، والمنصة لا تصدر فاتورة ضريبية.
16. ما نص الشروط الذي يقبله العميل عند الشراء؟ الافتراضي الآمن: لا نص ولا خانة قبول قبل المراجعة القانونية، والبيع مغلق للعموم.
17. هل البادئة MSR لأرقام طلبات المنصة مقبولة، ولا تتعارض مع مراجع الـCRM عند Tabby وTamara؟ الافتراضي الآمن: تُستعمل في الاختبار فقط، ويُتحقق منها قبل المرحلة 4.

## أفكار رُفضت

- الانتقال expired → paid الذي يقبل الدفعة المتأخرة مهما تأخرت (من «النقاء» و«البساطة»): يجعل الدفعة المتأخرة تتجاوز حد الكوبون الكلي، ويُنتج اشتراكين متراكبين، ويحسم سياسة لم يقررها المالك. البديل: expired نهائي، والدفعة المتأخرة ترجع order.not_payable، مع شرطين صلبين على المرحلة 4.
- احتساب حجز الكوبون بـexpires_at بدل الحالة المكتوبة (holdsRedemption من «النقاء»، وisOrderHoldingPromotion من «البساطة»): يحرر الاستخدام قبل أن يُغلق الطلب فعلًا، فتسمح دفعة متأخرة بتجاوز الحد. البديل: الاستخدام نشط حتى يُكتب الطلب منتهيًا تحت القفل، وهذا هو الاتجاه الآمن.
- الإلغاء التلقائي لطلبات العميل المعلّقة الأخرى عند إنشاء طلب جديد (superseded من «النقاء»): سياسة مخترعة، ويستطيع أي شخص يكتب جوال الضحية أن يلغي طلبها، وقد تصل دفعة طلب ملغى فيبقى مالها معلقًا. البديل: سقف تقني للطلبات المعلّقة لكل جوال.
- المهلة الفارغة تعني أن الطلب لا ينتهي أبدًا (من «البساطة»): تختار مهلة لا نهائية دون قرار المالك، وتسمح باستنزاف كوبون محدود إلى الأبد بأرقام مختلقة. البديل: المهلة الفارغة تمنع إنشاء أي طلب.
- بيع الاشتراك وقاعدة البدء غير محسومة، مع وعد «سيبلغك النادي بتاريخ البدء» (من «البساطة»): التزام أمام العميل لم يعتمده المالك. البديل: القاعدة الفارغة تمنع طلبات الاشتراك.
- قراءة قاعدة البدء والمنطقة الزمنية من clubs لحظة الدفع (من «البساطة»): تكسر لقطة الطلب، فقد يحصل المشتري على شروط لم يرها. البديل: تُختم القاعدة على سطر الاشتراك عند الإنشاء، ويفرضها CHECK.
- مفهوم «النشر» (published_at) وتعديل قراءة الكتالوج القائمة (من «النقاء»): توسيع لنطاق لم يُطلب. البديل: أعمدة النسخة التجارية ثابتة دائمًا بـtrigger، والمزايا تُجمَّد بعد أول بيع بقفل صف النسخة.
- تجميد المزايا بمقارنة clock_timestamp() بـvalid_from (من «البساطة»): يعتمد على تطابق ساعتي التطبيق والقاعدة، فيُفتح شق عند فرق التوقيت. البديل: فحص وجود سطر مبيع تحت قفل صف النسخة.
- نسخ جدول الانتقالات الكامل في plpgsql (من «السلامة»): ازدواج يحتاج ترحيلًا مع كل انتقال جديد. البديل: الجداول في المجال فقط، والقاعدة تفرض الثوابت الخشنة (النهائي نهائي، لا عودة إلى pending*payment، paid*\* لا تتغير).
- قيد CHECK يفرض max_redemptions_per_customer = 1 لعروض العملاء الجدد (من «السلامة»): سياسة عروض مخترعة داخل المخطط.
- ربط العلم بـSITE_INDEXABLE (من «السلامة»): أضعف من رفض العلم في الإنتاج على غير عنوان الجهاز، لأن المعاينة العامة غير المفهرسة كانت تستطيع تفعيله.
- حفظ اسم العميل في customers وعدم الكتابة فوقه: أي جوال غير موثق يستطيع تثبيت اسم لغيره. البديل: الاسم لقطة على الطلب وطلب التقييم فقط.
- تأجيل assessment_requests وrefunds وaudit_logs إلى مراحل لاحقة (من «البساطة»): القيد 6 ونطاق المرحلة يطلبانها صراحة، والتدقيق مطلوب لكل انتقال في DATABASE_SCHEMA.md.
- إعادة فحص مفتاح عدم التكرار بعد كل قفل لتفادي خطأ «الكوبون مستنفد» (اقتراح محكّم): استُبدل بقفل استشاري واحد على المفتاح في أول المعاملة. هو أبسط ويسلسل الطلبات المتطابقة مهما اختلف الجوال.
- ضريبة واحدة على إجمالي الطلب ثم توزيعها على السطور (من «النقاء»): صحيحة أيضًا، لكن الضريبة لكل سطر تتيح CHECK في القاعدة بالصيغة نفسها. اختيرت الثانية، والاصطلاح سؤال للمحاسب.
- التقريب لأسفل في الخصم المئوي مع النصف للأعلى في الضريبة (من «البساطة»): قاعدتا تقريب بدل قاعدة واحدة. يُبقي التصميم قاعدة واحدة، والفرق هللة واحدة على الأكثر.
- product_ids مصفوفة في promotions بلا مفتاح أجنبي، وبلا نطاق «كل المنتجات» (من «البساطة»): تفقد سلامة المرجع. البديل: جدول promotion_products ونطاق صريح.
- الوصول لصفحة المراجعة بكوكي آخر طلب (من «البساطة»): لا يعمل من جهاز آخر، ولا يصلح رابطًا لعودة المزوّد في المرحلة 4. البديل: رمز عشوائي من 32 بايت مع تقنيع الجوال وnoindex.
- قيد استبعاد يمنع تراكب الاشتراكات الآن: قاعدة التجديد غير محسومة (والامتداد btree_gist مثبَّت أصلًا، خلافًا لما ذكره مقترح «السلامة»).
