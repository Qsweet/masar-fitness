# المرحلة A5: ربط الإعلانات والقياس (المواصفة)

**الحالة:** منفَّذة على الفرع `claude/ecstatic-pascal-1y4z32` (القرار 88، وتصحيحات المراجعة في القرار 89، وأجوبة المالك وX والاحتفاظ في القرار 90، ودليل التحقق في `PROGRESS.md`). لا تكامل مفعَّل افتراضيًا: الموقع لا يحمّل وسمًا ولا يرسل حدثًا لأي منصة حتى يفعّلها المالك من اللوحة.
**الطلب (المالك):** «نحتاج الربط مع جوجل ادز و ميتا وسناب وتيكتوك بكسل بشكل احترافي جدا جدا وجوجل تاج مانجر وغيرها».
**المراجع الملزمة:** `CLAUDE.md`، `ANALYTICS.md` (المبادئ والأحداث)، `SECURITY.md` (CSP بـnonce، الأسرار، البيانات الشخصية)، `ADMIN_REDESIGN.md` §4.1 و§9-د (موضع «الربط» في «الإدارة»)، القرارات 14 و61–64.

**مفتاح التصنيف:** `[حقيقة]` بمصدر · `[متطلب]` · `[توصية]` · `[افتراض]` · `[خارجي]` · `[المالك]` قرار ينتظره.

## 0. الملخص

سبعة تكاملات بنمط واحد: **وسم المتصفح** يُحمَّل بعد موافقة الزائر وحدها، و**التحويل الخادمي** يُرسل الشراء بعد تحقق الدفع على الخادم، والاثنان يحملان **معرّف حدث واحدًا** فتُسقط المنصة المكرر. الإعداد من **صفحة «الربط والقياس»** في مجموعة «الإدارة»: تفعيل لكل منصة، ومعرّفاتها العامة، ومفتاحها الخادمي **مشفّرًا لا يُعرض**، ورمز أحداث الاختبار، وزر «أرسل حدث اختبار»، وسجل آخر الإرسالات بلا بيانات شخصية.

| المنصة             | في المتصفح (بعد الموافقة)                          | من الخادم (بعد الدفع المتحقق)           | فئة الموافقة                 |
| ------------------ | -------------------------------------------------- | --------------------------------------- | ---------------------------- |
| Google Tag Manager | الحاوية + `dataLayer`                              | —                                       | تحليلات وإعلانات معًا (89-6) |
| Google Analytics 4 | `gtag.js` + أحداث التجارة                          | Measurement Protocol: `purchase`        | تحليلات                      |
| Google Ads         | تحويل `purchase` + التحويلات المحسّنة (جوال مجزّأ) | لا (§4.3: يحتاج Google Ads API، مؤجَّل) | إعلانات                      |
| Meta               | Pixel                                              | Conversions API: `Purchase`             | إعلانات                      |
| Snapchat           | Snap Pixel                                         | Conversions API v3: `PURCHASE`          | إعلانات                      |
| TikTok             | TikTok Pixel                                       | Events API 2.0: `CompletePayment`       | إعلانات                      |
| X (Twitter)        | X Pixel: الشراء والسلة والاستفسار بمعرّفات أحداث   | لا (§4.3: يحتاج Ads API، القرار 90-1)   | إعلانات                      |

## 1. المراجع الرسمية (قُرئت في 2026-11-27)

كل حقل وعنوان وقاعدة تجزئة أدناه من هذه الوثائق. ما لم يُقرأ من مصدر رسمي معلَّم `[خارجي]` في مكانه.

| المنصة | الوثيقة                                                                       | الرابط                                                                                                                |
| ------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Google | إرسال أحداث Measurement Protocol                                              | https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events                              |
| Google | مرجع Measurement Protocol (`consent`، `user_data`، الحدود)                    | https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference                                   |
| Google | التحقق (`/debug/mp/collect`)                                                  | https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events                           |
| Google | Consent Mode للمطوّر (`default`/`update`)                                     | https://developers.google.com/tag-platform/security/guides/consent                                                    |
| Google | Tag Manager وCSP (المضيفات لكل وسم)                                           | https://developers.google.com/tag-platform/security/guides/csp                                                        |
| Google | أحداث التجارة في GA4                                                          | https://developers.google.com/analytics/devguides/collection/ga4/ecommerce                                            |
| Google | التحويلات المحسّنة للويب (`user_data`، E.164، SHA-256)                        | https://support.google.com/google-ads/answer/13258081                                                                 |
| Meta   | استعمال Conversions API (العنوان، `test_event_code`، حد 7 أيام)               | https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api                              |
| Meta   | معاملات بيانات العميل (`ph`، `external_id`، `fbc`، `fbp`)                     | https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters |
| Meta   | معاملات الحدث الخادمي (`event_id`، `action_source`)                           | https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event                    |
| Meta   | إزالة التكرار بين Pixel والخادم (`eventID`، 48 ساعة)                          | https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events        |
| Meta   | `fbc` و`fbp` (الصيغة من `fbclid`)                                             | https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc                     |
| Meta   | Pixel: الشيفرة الأساسية                                                       | https://developers.facebook.com/documentation/ads-commerce/meta-pixel/get-started                                     |
| Snap   | البدء (الرمز طويل الأجل، الحدود)                                              | https://developers.snap.com/api/marketing-api/Conversions-API/GetStarted                                              |
| Snap   | استعمال الواجهة (v3، `validate`، `ScCid`، `data_use`)                         | https://developers.snap.com/api/marketing-api/Conversions-API/UsingTheAPI                                             |
| Snap   | المعاملات (`ph`، `sc_click_id`، `sc_cookie1`)                                 | https://developers.snap.com/api/marketing-api/Conversions-API/Parameters                                              |
| Snap   | إزالة التكرار (`client_dedup_id` ⇄ `event_id`، `transaction_id` ⇄ `order_id`) | https://developers.snap.com/api/marketing-api/Conversions-API/Deduplication                                           |
| Snap   | قالب Snap Pixel الرسمي لـGTM (`snaptr`، المضيفات)                             | https://github.com/Snapchat/snapchat-google-tag-manager                                                               |
| TikTok | Events API 2.0 (نظرة عامة)                                                    | https://business-api.tiktok.com/portal/docs/events-api-2.0/v1.3                                                       |
| TikTok | قالب Events API الرسمي (بنية الجسم كاملة، `Access-Token`)                     | https://github.com/tiktok/gtm-template-eapi                                                                           |
| TikTok | قالب Pixel الرسمي (`ttq.track` مع `event_id`، أسماء الأحداث)                  | https://github.com/tiktok/gtm-template-pixel                                                                          |

| X | قالب X Pixel الرسمي لـGTM: الأساسي (`twq('config')`، `uwt.js`، نمط البكسل) | https://github.com/twitter/google-tag-manager-base-tag |
| X | قالب أحداث X الرسمي (`twq('event')`، نمط `tw-…-…`، `conversion_id`، `twclid`) | https://github.com/twitter/google-tag-manager-event-tag |
| X | قالب Conversion API الرسمي لـGTM الخادمي (`X-Pixel-Token`) | https://github.com/twitter/x-ads-conversion-api-gtm-template |
| X | المصادقة في Ads API (OAuth 1.0a برمز مستخدم) | https://docs.x.com/x-ads-api/fundamentals/making-authenticated-requests |
| X | تحويلات الويب (Conversion API)، ودليل GTM الخادمي | https://docs.x.com/x-ads-api/measurement/web-conversions ، https://docs.x.com/x-ads-api/measurement/gtm-server-side |
| Google | نوافذ التحويل (1 إلى 90 يومًا) لمدة الاحتفاظ | https://support.google.com/google-ads/answer/3123169 |

`[خارجي]` صفحات `docs.x.com` و`support.google.com` و`developers.snap.com` غير متاحة من بيئة العمل في 2026-11-28: ما نُسب إليها أعلاه من مقتطفات البحث فيها لا من قراءتها كاملة، والمقروء نصًّا قوالب X الرسمية على GitHub وسكربته `static.ads-twitter.com/uwt.js` نفسه (المضيفات وأسماء الكوكيات والمزايا الآلية وتجزئة `phone_number`).

`[خارجي]` صفحات TikTok في بوابة المطوّرين تُرسم بـJavaScript فلم تُقرأ نصًّا؛ البنية أُخذت من قالبي TikTok الرسميين على GitHub (شيفرتهما ترسل إلى الواجهة نفسها)، وقاعدة الجوال (E.164 ثم SHA-256) من مقتطف الوثيقة الرسمية. **قبل تفعيل TikTok الخادمي يُرسل المالك حدث اختبار** ويتأكد من ظهوره في Events Manager (§8). الشيفرة الأساسية لـTikTok Pixel منقولة كما تنشرها TikTok في Events Manager (رابط `analytics.tiktok.com/i18n/pixel/events.js`)، ويُطابقها المالك بما يعرضه له Events Manager عند الإعداد.

## 2. خريطة الأحداث

الحدث يُعرَّف مرة في المجال (`packages/domain/src/tracking/events.ts`) ثم يُترجم لكل منصة. أسماء GA4 هي المرجع (`ANALYTICS.md` §2).

| حدثنا            | متى بالضبط                                            | GA4 / GTM        | Meta               | Snap             | TikTok             | X                             | المصدر                |
| ---------------- | ----------------------------------------------------- | ---------------- | ------------------ | ---------------- | ------------------ | ----------------------------- | --------------------- |
| `page_view`      | كل تنقل (أول تحميل وتغيّر المسار)                     | `page_view`      | `PageView`         | `PAGE_VIEW`      | `ttq.page()`       | `twq('config')`               | متصفح                 |
| `view_item`      | صفحة اشتراك واحد                                      | `view_item`      | `ViewContent`      | `VIEW_CONTENT`   | `ViewContent`      | —                             | متصفح                 |
| `add_to_cart`    | صفحة السلة بعد «أُضيف» (`?note=added`) والاشتراك فيها | `add_to_cart`    | `AddToCart`        | `ADD_CART`       | `AddToCart`        | معرّف حدث السلة (اختياري)     | متصفح                 |
| `begin_checkout` | صفحة بيانات الشراء للاشتراك                           | `begin_checkout` | `InitiateCheckout` | `START_CHECKOUT` | `InitiateCheckout` | —                             | متصفح                 |
| `generate_lead`  | إرسال نموذج الاستفسار (يفتح واتساب)                   | `generate_lead`  | `Lead`             | `SIGN_UP`        | `Contact`          | معرّف حدث الاستفسار (اختياري) | متصفح                 |
| `purchase`       | **طلب حالته مدفوع في القاعدة**                        | `purchase`       | `Purchase`         | `PURCHASE`       | `CompletePayment`  | معرّف حدث الشراء (مطلوب)      | **خادم** + نسخة متصفح |

- **لا حجز تقييم في الموقع اليوم** (جدول `assessment_requests` بلا واجهة)، فلا `generate_lead` له؛ يُضاف مع صفحته.
- **`generate_lead` لا يحمل شيئًا مما كُتب في النموذج:** اسم الحدث ونوع الاهتمام (`interest`، قائمة مغلقة) فقط، فيبقى نص النموذج «لا يُرسل لطرف ثالث» صادقًا.
- **Snap بلا حدث «Lead» في قائمة القالب الرسمي**؛ `SIGN_UP` أقرب حدث قياسي (البديلان `SUBSCRIBE` و`RESERVE` يخلطان بالشراء والحجز). اعتمده المالك («الأكثر احترافية»)، القرار 90-5.
- **X بلا أسماء أحداث ثابتة:** لكل حدث معرّف `tw-<البكسل>-<الحدث>` يُنشئه المالك في Ads Manager، وما لم يُضبط لا يُرسل. حدث الاستفسار باسمه وحده بلا بيانات.
- **القيمة:** من الطلب أو الاشتراك بالهللة، وتُحوَّل إلى ريال عند الإرسال وحده (`toMajorUnits`، نص عشري بخانتين). العملة `SAR`.
- **المنتج:** `item_id` = رمز الاشتراك (`slug`)، والاسم بلغة الصفحة. لا سعر من الواجهة: القيمة يكتبها الخادم في الصفحة.

### 2.1 معرّف الحدث وإزالة التكرار

| الحدث      | المعرّف                        | لماذا                                                                     |
| ---------- | ------------------------------ | ------------------------------------------------------------------------- |
| `purchase` | `purchase.<order_id>`          | مشتق من الطلب: المتصفح والخادم يعرفانه دون تنسيق، والإعادة لا تكرر الشراء |
| غيره       | UUID عشوائي لكل حدث في المتصفح | لا نسخة خادمية تُطابَق                                                    |

قواعد المنصات `[حقيقة]`: Meta تُسقط الحدث الثاني بالاسم و`event_id`/`eventID` نفسيهما خلال 48 ساعة؛ Snap تطابق `client_dedup_id` في Pixel مع `event_id` في الخادم، و`transaction_id` مع `order_id` للشراء (نافذة 30 يومًا)؛ TikTok تطابق `event_id` للبكسل نفسه؛ GA4 وGoogle Ads بـ`transaction_id`. نسخة المتصفح من الشراء تُرسل **مرة لكل متصفح** (علامة في `sessionStorage`)، والمنصات تُسقط ما يتكرر بعدها.

### 2.2 لماذا نسخة متصفح للشراء (تعديل على `ANALYTICS.md` §1-1)

المبدأ «`purchase` من الخادم فقط» كان يمنع **حدث شراء قبل التحقق**. المنفَّذ يحفظه: صفحة الطلب تكتب حدث الشراء **فقط إن كانت حالة الطلب في القاعدة مدفوعًا** (لا من رابط العودة ولا من المتصفح)، وبمعرّف الخادم نفسه. السبب: Google Ads بلا واجهة خادمية هنا (§4.3)، ونسخة المتصفح ترفع المطابقة في المنصات الأخرى، والتكرار تُسقطه المنصة. القرار 88-3.

## 3. الموافقة (نظام حماية البيانات الشخصية)

`[حقيقة]` النظام نافذ ويشترط الموافقة والحد الأدنى من البيانات (`SECURITY.md` §6). **لا نصوص قانونية مخترعة:** ما يحتاج المراجع مذكور في §3.4.

### 3.1 الفئات

| الفئة   | ما تفتحه                                                       | الافتراضي        |
| ------- | -------------------------------------------------------------- | ---------------- |
| ضرورية  | الجلسة، السلة، كوكي الموافقة نفسه، كوكي الإسناد الداخلي (§5.1) | دائمًا، بلا خيار |
| تحليلات | GA4 (وGTM إن كانت هذه وحدها)                                   | مرفوضة حتى يوافق |
| إعلانات | Google Ads وMeta وSnap وTikTok وX (وGTM)                       | مرفوضة حتى يوافق |

### 3.2 السلوك

1. **الشريط يظهر فقط حين يُفعَّل تكامل واحد على الأقل.** بلا تكامل لا كوكي غير ضروري، فلا شريط ولا سطر JavaScript إضافي.
2. **ثلاثة أزرار بالوزن نفسه:** «أوافق على الكل»، «الضرورية فقط»، «اختيار الفئات» (يفتح خانتين). الرفض بنقرة واحدة كالقبول. لا خانة مختارة مسبقًا.
3. **لا سكربت طرف ثالث قبل الموافقة** (Consent Mode «الأساسي»): لا يُحمَّل `gtag.js` ولا GTM ولا أي بكسل قبلها. حين يُحمَّل Google يُضبط أولًا `gtag('consent','default', …)` كله `denied`، ثم `update` بما وافق عليه الزائر فقط (`ad_storage` و`ad_user_data` و`ad_personalization` مع الإعلانات، و`analytics_storage` مع التحليلات).
4. **الحفظ:** كوكي طرف أول `masar_consent` (‏`v1.a<0|1>.d<0|1>.<ثواني>`، 180 يومًا، `SameSite=Lax`، `Secure` على HTTPS، يقرؤه المتصفح والخادم). نسخة النص (`CONSENT_VERSION`) داخل القيمة: تغيير النص برفع النسخة يعيد السؤال.
5. **السحب:** رابط «إعدادات الخصوصية» في التذييل يفتح الشريط نفسه في أي وقت. خفض فئة ⇒ `consent update` بـ`denied` لـGoogle، ثم **محو كوكيات المنصات للفئة المسحوبة** على النطاق وآبائه (89-8)، ثم **إعادة تحميل الصفحة** فلا يبقى بكسل محمَّل.
6. **مع الطلب:** الموافقة لحظة إنشاء الطلب تُحفظ في `order_tracking` (الفئتان والنسخة والوقت)، والخادم لا يرسل شراءً لمنصة لم تُوافَق فئتها **على ذلك الطلب**، مهما تغيّر الكوكي بعدها.

### 3.3 الوصول

`<section role="region">` بعنوان، في أسفل الشاشة بلا حجب للمحتوى (ليس نافذة إجبارية)، تركيز لوحة المفاتيح عادي، الأزرار ≥ 44px، والنص بلغة الصفحة (العربية المرجع). بلا `style` مضمَّن (CSS Modules).

### 3.4 ما حسمه المالك (القرار 90)

البنود أدناه كانت مفتوحة وحسمها المالك في 2026-11-28؛ النص الأصلي باقٍ للسياق.

### 3.4.1 البنود كما طُرحت

1. **صياغة الشريط وصفحة الخصوصية** (`consent-ar.ts`، `privacy-ar.ts`): كُتبت وصفًا لما يفعله الكود فقط، بلا ادعاء امتثال ولا أساس نظامي مسمّى. المراجع يعتمدها أو يعدّلها.
2. **نقل البيانات خارج المملكة:** المنصات الأربع تعالج خارجها. الصفحة تقول ذلك بلا حكم قانوني، والحكم للمراجع (`SECURITY.md` §7).
3. **الجوال المجزّأ لمنصات الإعلان** (`ANALYTICS.md` §10): يُرسل **فقط مع موافقة الإعلانات على الطلب**. إن رفض المراجع: يُطفأ بإزالة الحقل من بانيات الحمولة (سطر لكل منصة)، والإرسال يبقى بالمعرّفات التقنية وحدها.
4. **مدة الاحتفاظ** بـ`order_tracking` (فيه عنوان IP ووكيل المتصفح ومعرّفات النقر): مقترح 90 يومًا ثم تفريغ الحقول التقنية.

**القرار (90):** النص معتمد كما كُتب (1)؛ نقل البيانات خارج المملكة وصفٌ بلا حكم كما هو (2)؛ الجوال المجزّأ يبقى مع موافقة الإعلانات، ولكل منصة خانة «إرسال الجوال المجزّأ» مفعّلة افتراضيًا تطفئه لها وحدها (3)؛ الاحتفاظ 90 يومًا ثم تفريغ آلي (4، §7.1).

## 4. التحويلات الخادمية

### 4.1 التدفق

```
الدفع المتحقق (applyProviderSnapshot أو الدفع اليدوي)
   └─ settleInTransaction ── recordPayment ── enqueuePurchaseConversions  (المعاملة نفسها)
                                                │ سطر لكل منصة مفعَّلة + مفتاح مضبوط + فئة موافَقة على الطلب
                                                ▼
                                       tracking_outbox (pending)
   مؤقت systemd كل دقيقة: pnpm --filter @masar/tracking tracking:dispatch
                                                ▼
                     claim بـFOR UPDATE SKIP LOCKED ← بناء الحمولة من الطلب ← إرسال ← تسجيل النتيجة
```

- **الحجز:** دفعة 50 بمهلة `دفعة × 10 ثوانٍ × 2 + دقيقة` ورمز `claim_token` جديد؛ النتيجة تُكتب بالرمز الحالي وحده (89-2).
- **مرة لكل طلب ومنصة:** قيد فريد `(club_id, provider, event_name, event_id)` على السطور الحية، والإدراج `ON CONFLICT DO NOTHING`، والإعادة (`replayed`) لا تُدرج شيئًا.
- **لا يعطّل الشراء:** الإدراج سطر SQL واحد في معاملة التسوية بلا أي اتصال خارجي؛ الإرسال خارج الطلب كليًّا.
- **الحمولة تُبنى عند الإرسال** من الطلب و`order_tracking`، والمفتاح يُفك عند الإرسال فقط ولا يُخزَّن مفكوكًا.
- **الدفع اليدوي يُحتسب شراءً** (انتقال الطلب إلى مدفوع هو نفسه). أكّده المالك (القرار 90-4).

### 4.2 الإعادة والفشل

| الرد                                               | القرار                                   |
| -------------------------------------------------- | ---------------------------------------- |
| 2xx (وTikTok `code = 0` في الجسم)                  | `sent`                                   |
| 408، 429، 5xx، انقطاع أو مهلة 10 ثوانٍ             | إعادة بعد 1، 5، 30، 120، 720 دقيقة       |
| 4xx غيرها (حمولة أو مفتاح خاطئ)                    | `dead` فورًا: الإعادة لا تصلحه           |
| تيك توك: `code` غير الصفر في جسم 200 (89-7)        | إعادة حتى أقصى المحاولات ثم `dead`       |
| استثناء في حدث واحد (89-3)                         | `internal_error` إعادةً، ولا توقف الدفعة |
| بعد 6 محاولات                                      | `dead`                                   |
| الحدث أقدم من حد المنصة (Meta 7 أيام، GA4 72 ساعة) | `dead` بسبب `too_old` بلا إرسال          |
| المنصة أُطفئت أو حُذف مفتاحها أو المفتاح لا يُفك   | `skipped` بسببه                          |

السجل يحفظ: المنصة، الحدث، الحالة، عدد المحاولات، رمز HTTP، ورمز سبب ثابت (`http_400`، `timeout`، `too_old`…). **لا جسم رد ولا حمولة** (قد تحمل ما أُرسل).

### 4.3 الحمولة لكل منصة

**GA4 Measurement Protocol** — `POST https://www.google-analytics.com/mp/collect?measurement_id=…&api_secret=…`
`client_id` من كوكي `_ga` (الجزآن الأخيران)، وإلا لا إرسال (`no_client_id`: GA4 يحتاجه). `events[0] = {name: "purchase", params: {transaction_id: <المرجع>, value, currency, items[]}}`، و`timestamp_micros` = وقت الدفع، و`consent: {ad_user_data, ad_personalization}` من موافقة الطلب. لا `user_data` (لا بريد عندنا، والجوال المجزّأ لـGA4 لا يلزم). الاختبار على `/debug/mp/collect` (لا يُسجَّل في التقارير) ويُعرض عدد `validationMessages`.

**Google Ads** — في المتصفح فقط: `gtag('event','conversion',{send_to:'AW-…/label', value, currency, transaction_id})` على صفحة الطلب المدفوع، ومعه `gtag('set','user_data',{sha256_phone_number})` بالجوال E.164 مجزّأً على الخادم، **في أول عرض للطلب وحده** وبموافقة الإعلانات الآن ولحظة الشراء (89-1). **الإرسال الخادمي** يحتاج Google Ads API (رمز مطوّر معتمد وOAuth وحساب مدير)؛ مؤجَّل، والبديل الموثَّق ربط GA4 بـGoogle Ads واستيراد حدث `purchase` (يصل من الخادم عبر MP). القرار 88-5.

**Meta Conversions API** — `POST https://graph.facebook.com/v27.0/<PIXEL_ID>/events?access_token=…`
`data[0] = {event_name: "Purchase", event_time: <ثواني الدفع>, event_id, action_source: "website", event_source_url, user_data: {ph: [sha256], external_id: [sha256(customer_id)], client_ip_address, client_user_agent, fbc, fbp}, custom_data: {currency, value, order_id, content_ids, content_type: "product", contents[]}}`، و`test_event_code` في الجسم عند الاختبار. الجوال: أرقام فقط بمفتاح الدولة بلا `+` ولا أصفار بادئة (`9665XXXXXXXX`). `fbc` من الكوكي، وإلا يُبنى من `fbclid` بالصيغة `fb.1.<ملي ثانية>.<fbclid>`. تنبيه Meta: أحداث `test_event_code` **لا تُسقط** وتدخل القياس، فحدث الاختبار عندنا حدث مخصّص `MasarTestEvent` لا `Purchase`.

**Snap Conversions API v3** — `POST https://tr.snapchat.com/v3/<PIXEL_ID>/events?access_token=…`
`data[0] = {event_name: "PURCHASE", event_time, event_id, action_source: "WEB", event_source_url, user_data: {ph: [sha256], external_id: [sha256], client_ip_address, client_user_agent, sc_click_id, sc_cookie1}, custom_data: {currency, value, order_id, content_ids, num_items}}`. الجوال كقاعدة Meta (أرقام بمفتاح الدولة، بلا `+`). الاختبار على `/v3/<PIXEL_ID>/events/validate` (لا يُحتسب).

**TikTok Events API 2.0** — `POST https://business-api.tiktok.com/open_api/v1.3/event/track/` بترويسة `Access-Token`
`{event_source: "web", event_source_id: <PIXEL_CODE>, test_event_code?, data: [{event: "CompletePayment", event_time, event_id, page: {url}, user: {phone: sha256(E.164 بـ+), external_id: sha256, ttclid, ttp, ip, user_agent}, properties: {currency, value, order_id, content_type: "product", contents: [{content_id, content_name, price, quantity}]}}]}`. الرد 200 بجسم `code`؛ غير الصفر خطأ (`api_<code>`). رمز الاختبار يُستعمل للاختبار وحده: TikTok لا تحفظ الحدث الحي الذي يحمله.

**X** — في المتصفح فقط (القرار 90-1): `twq('event', <معرّف حدث الشراء>, {value, currency, conversion_id: purchase.<order_id>, contents: [{content_id, content_name, content_price, num_items}], phone_number?: sha256(E.164 بـ+), twclid?})`. `phone_number` مجزّأً على الخادم (uwt.js يمرّر قيمة SHA-256 كما هي ويجزّئ غيرها)، و`twclid` من اللمسة المختومة، كلاهما في أول عرض للطلب وبموافقة الإعلانات الآن ولحظة الشراء (89-1). قبل `config` تُطفأ مزايا uwt.js الآلية (`autoConfig`، `autoAdvancedMatching`، `dataLayerTracking`، `autoDwellTracking`). **الإرسال الخادمي** لا يُبنى: مرجع Conversion API يطلب تطبيق Ads API معتمدًا وOAuth 1.0a برمز مستخدم، والطريق الأحدث برمز البكسل (`X-Pixel-Token`) موثَّق في دليل GTM الخادمي وقالبه وحدهما ويخالف المرجع في حقل الوقت (`conversion_timestamp` بالملي ثانية مقابل `conversion_time` ISO-8601)، بلا نقطة اختبار موثَّقة. يُعاد النظر حين تُقرأ وثيقته الحالية كاملة.

**X داخل GTM:** لا يُضبط وسم X الأساسي ولا أحداثه داخل حاوية GTM أيضًا: يُحمَّل البكسل مرتين ويُحسب الحدث مرتين (صفحة X في اللوحة تنبّه لذلك). إن وجد محمّلنا `twq` قائمًا قبله طبّق أوامر إطفاء المزايا الآلية عليه، ونبّه المطوّر في وحدة التحكم في التطوير وحده.

**مفتاح الجوال لكل منصة (القرار 90-3):** `config.sendHashedPhone` (الغائب مفعَّل). مطفأ ⇒ لا `ph` في Meta وSnap، ولا `phone` في TikTok، ولا `user_data` في Google Ads، ولا `identify` في TikTok، ولا `phone_number` في X؛ والبقية كما هي.

### 4.4 التجزئة (ملخص)

| المنصة                | الجوال قبل SHA-256                | مثال `+966 5X XXX XXXX` |
| --------------------- | --------------------------------- | ----------------------- |
| Meta، Snap            | أرقام فقط، بمفتاح الدولة، بلا `+` | `9665XXXXXXXX`          |
| Google Ads، TikTok، X | E.164 بـ`+`                       | `+9665XXXXXXXX`         |

SHA-256 ست عشري بحروف صغيرة. `external_id` = SHA-256 لمعرّف العميل عندنا (UUID، لا جوال)، والقيمة نفسها لكل المنصات. اختبار وحدة يتحقق من مثال Snap الرسمي (`448444124653` ← `dc008fda…`).

## 5. تدفق البيانات

### 5.1 الإسناد (كوكي طرف أول)

الوسيط (`proxy.ts`) يكتب `masar_attr` (HttpOnly، Secure، SameSite=Lax، 90 يومًا) **فقط حين تُفعَّل منصة** (89-4): أول لمسة لا تُستبدل، وآخر لمسة تُحدَّث، ووقت كل منها وصفحة الهبوط. قبل موافقة الإعلانات يحفظ `utm_source` و`utm_medium` و`utm_campaign` و`utm_content` و`utm_term` وحدها؛ `gclid` و`gbraid` و`wbraid` و`fbclid` و`ScCid` و`ttclid` و`twclid` (القرار 90-1) مع الموافقة فقط، ولحظة منحها يأخذها إجراء خادم من رابط الصفحة الحالية (من غادر صفحة الهبوط قبل الموافقة يفقدها). كل قيمة بحد طول ونمط محارف صارمين، وما خالف يُسقط. **ولا يخرج لأي منصة إلا مع موافقة الإعلانات على الطلب**.

### 5.2 عند إنشاء الطلب

إجراء الشراء يكتب `order_tracking` بعد إنشاء الطلب (إدراج بلا تحديث، `ON CONFLICT DO NOTHING`، وفشله يُسجَّل ولا يُسقط الطلب):
الموافقة (الفئتان، النسخة، الوقت)، الإسناد (اللمستان)، ومعرّفات المتصفح **فقط مع موافقة الإعلانات أو التحليلات بحسب صاحبها**: `_ga` (تحليلات)، `_fbp`/`_fbc`/`_scid`/`_ttp` (إعلانات)، وعنوان IP ووكيل المتصفح (إعلانات). بلا موافقة تُحفظ الموافقة واللمستان فقط.

### 5.3 الإعداد في الموقع العام

`tracking_integrations` لنادي الموقع (أقدم نادٍ، القرار 71-4) يُقرأ بذاكرة 30 ثانية مشتركة بين الوسيط والصفحات (`globalThis`)، وحفظ اللوحة يفرّغها في العملية نفسها. القاعدة معطلة ⇒ لا تكاملات (الاتجاه الآمن: لا وسم ولا CSP موسَّعة).

## 6. CSP

`script-src` بـ`nonce` و`'strict-dynamic'` كما هو (القرار 14): سكربت محمَّل من حزمتنا الموثوقة يحمّل الوسوم، والـnonce يُمرَّر لكل سكربت مُدرَج (وGTM ينقله لوسومه). ما يُضاف **فقط لمنصة مفعَّلة، ولصفحات الموقع العام لا اللوحة**، من جدول Google الرسمي وقوالب Snap وTikTok:

| المنصة                    | `connect-src`                                                                                                                                                                 | `img-src`                                           | `frame-src`                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------- |
| GTM                       | `www.googletagmanager.com` `www.google.com`                                                                                                                                   | `www.googletagmanager.com`                          | `www.googletagmanager.com` |
| GA4 (بلا مزايا الإعلانات) | `www.googletagmanager.com` `*.google-analytics.com` `*.google.com`                                                                                                            | `www.googletagmanager.com` `*.google-analytics.com` | —                          |
| Google Ads                | `www.googletagmanager.com` `www.googleadservices.com` `googleads.g.doubleclick.net` `pagead2.googlesyndication.com` `www.google.com` `www.google.com.sa` `ad.doubleclick.net` | الستة الأولى و`www.google.com.sa`                   | `www.googletagmanager.com` |
| Meta                      | `www.facebook.com` `connect.facebook.net`                                                                                                                                     | `www.facebook.com`                                  | —                          |
| Snap                      | `tr.snapchat.com`                                                                                                                                                             | `tr.snapchat.com`                                   | —                          |
| TikTok                    | `analytics.tiktok.com`                                                                                                                                                        | `analytics.tiktok.com`                              | —                          |
| X                         | `t.co` `analytics.twitter.com`                                                                                                                                                | `t.co` `analytics.twitter.com`                      | —                          |

`frame-src` غائب اليوم (يرث `default-src 'self'`)؛ يُكتب صراحةً `'self'` ومعه المضيف حين يلزم. `[حقيقة]` Google تطلب كل نطاق `google.<TLD>` صراحةً؛ المضاف `google.com.sa` لجمهور المملكة. `[خارجي]` أي وسم يضيفه المالك داخل GTM لمنصة أخرى يحتاج مضيفه هنا (قرار وسطر في الجدول)، وإلا تحجبه CSP: هذا مقصود.

## 7. البيانات (ترحيل `20261202090000_tracking`)

| الجدول                  | الغرض                                    | أهم القيود                                                                                                                          |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tracking_integrations` | إعداد كل منصة لكل نادٍ                   | PK `(club_id, provider)`، `provider` من القائمة، `config` JSONB كائن، المفتاح `secret_enc` نص مشفّر و`secret_last4` أربعة محارف     |
| `order_tracking`        | الموافقة والإسناد ومعرّفات المتصفح للطلب | PK `order_id` (FK)، للإدراج فقط (trigger)، حدود الطول                                                                               |
| `tracking_outbox`       | طابور الإرسال وسجله (الحي والاختبار)     | الحالة من القائمة، فريد `(club_id, provider, event_name, event_id)` للحي، فهرس `(status, next_attempt_at)` و`(club_id, created_at)` |

التفصيل في `DATABASE_SCHEMA.md` §16. التدقيق يقبل `tracking_integration`.

### 7.1 الاحتفاظ وتقليل البيانات (القرار 90-6، ترحيل `20261204090100_tracking_retention`)

| ما يُفرَّغ بعد 90 يومًا من إنشاء الطلب                                                                         | ما يبقى                                                                     |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `client_ip`، `user_agent`، `ga_client_id`، `fbp`، `fbc`، `scid`، `ttp`، `page_url`، ومعرّفات النقر في اللمستين | الموافقة ونسختها ووقتها، و`utm_*`، وصفحة الهبوط، ووقت كل لمسة، و`purged_at` |

- **المدة:** 90 يومًا = أطول نافذة إسناد للنقر نبني عليها (Google Ads: من يوم إلى 90 يومًا، https://support.google.com/google-ads/answer/3123169). بعدها لا منصة تقبل التحويل، ولا حاجة للمعرّف.
- **الأمر:** `pnpm --filter @masar/tracking tracking:purge` بمؤقت يومي (`DEPLOYMENT.md`)؛ دفعات 500 بـ`FOR UPDATE SKIP LOCKED` حتى 200 دفعة للتشغيل، والباقي للتالي. يطبع العدد وحده.
- **ثبات السطر:** `order_tracking_guard_update` يرفض أي تحديث إلا التفريغ بعينه: أول `purged_at`، وكل معرّف null، واللمستان = `tracking_scrub_touch(القديمة)`، وبقية الأعمدة كما هي.
- **الطابور:** لا حمولة فيه ولا جسم رد (88-7)؛ يبقى سجلًّا بالحالة والرمز. المعلّق الأقدم من الحد يُغلق `dead` بسبب `retention_purged`.
- **صفحة الطلب** لا تنشر جوالًا ولا `twclid` لطلب فُرِّغ.

## 8. صفحة «الربط والقياس» في اللوحة

**المكان:** ‎`/admin/integrations`‎ في مجموعة «الإدارة» بعد «سجل التدقيق»، والمنصة في ‎`/admin/integrations/<provider>`‎. بطاقات بحالة كل منصة («مفعَّل»، «متوقف»، «ينقصه المفتاح الخادمي»)، ثم سجل آخر 50 إرسالًا.

| الصلاحية               | الأدوار        | ما تفتحه                                                             |
| ---------------------- | -------------- | -------------------------------------------------------------------- |
| `integrations.manage`  | المالك، المدير | الصفحتان، التفعيل، المعرّفات العامة، رمز الاختبار، «أرسل حدث اختبار» |
| `integrations.secrets` | المالك         | كتابة المفتاح الخادمي أو حذفه                                        |

`[المالك]` المواصفة الأولى (`permissions.ts`) جعلت «الربط والمفاتيح» خارج المدير؛ الطلب يجعل الصفحة للمالك والمدير. التسوية: المدير يدير كل شيء عدا كتابة المفتاح.

- **المفتاح للكتابة فقط:** حقل كلمة مرور فارغ دائمًا، وتحته «مضبوط · آخره 1234» أو «غير مضبوط»؛ لا يرجع إلى الصفحة ولا إلى السجل ولا إلى التدقيق. حفظ فارغ لا يمسّه، وخانة «احذف المفتاح» تحذفه.
- **التشفير:** AES-256-GCM (‏`sealSecret` القائم) بمفتاح فرعي مشتق من `ADMIN_SECRET_KEY` بـHKDF-SHA-256 (‏`info = "masar:tracking-secret:v1"`)، و`club_id:provider` بيانات موثَّقة (AAD) فلا يُنقل مفتاح من صف إلى آخر. تدوير `ADMIN_SECRET_KEY` يُبطل المفاتيح المحفوظة: الصفحة تعرض «لا يُفك، أعد إدخاله» والإرسال `skipped` (القرار 88-4).
- **التحقق:** كل معرّف بنمطه (`GTM-…`، `G-…`، `AW-<أرقام>` والتسمية، أرقام Pixel لـMeta، UUID لـSnap، رمز TikTok)، والتفعيل مرفوض بلا المعرّف الذي يحتاجه الوسم.
- **حدث الاختبار:** إجراء خادم يبني حدثًا اختباريًا (بلا بيانات عميل)، ويرسله بالناقل نفسه إلى نقطة الاختبار أو برمز الاختبار، ويسجّله `kind = test` بالرد. 10 محاولات لكل موظف في عشر دقائق.
- **التدقيق:** `tracking_integration_updated` بالمنصة وما تغيّر (`enabled`، أسماء الحقول المتغيرة، `secretChanged` نعم/لا)؛ بلا قيمة مفتاح ولا آخر أربعة.
- **تحذير GTM:** إن فُعّل GTM مع GA4 أو Google Ads مباشرةً، تنبيه بأن الوسم نفسه داخل الحاوية يضاعف القياس.

### 8.1 ما يُدخله المالك (وأين يجده)

| المنصة     | الحقل                                       | مكانه في لوحة المنصة                                                                                            |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GTM        | معرّف الحاوية `GTM-XXXXXXX`                 | tagmanager.google.com ← الحاوية ← أعلى الصفحة بجانب اسم مساحة العمل                                             |
| GA4        | معرّف القياس `G-XXXXXXXXXX`                 | Analytics ← المشرف ← مصادر البيانات ← تدفق الويب                                                                |
| GA4        | سر Measurement Protocol (خادمي)             | التدفق نفسه ← «أسرار واجهة Measurement Protocol» ← إنشاء                                                        |
| Google Ads | معرّف التحويل `AW-XXXXXXXXX` وتسمية التحويل | Google Ads ← الأهداف ← التحويلات ← إجراء الشراء ← إعداد الوسم ← «تثبيت الوسم بنفسك» (`send_to: 'AW-…/التسمية'`) |
| Meta       | معرّف Pixel (مجموعة البيانات)               | Events Manager ← مصادر البيانات ← المجموعة ← الإعدادات                                                          |
| Meta       | رمز Conversions API (خادمي)                 | المجموعة نفسها ← الإعدادات ← Conversions API ← «إنشاء رمز وصول»                                                 |
| Meta       | رمز أحداث الاختبار                          | Events Manager ← «اختبار الأحداث» ← تبويب الخادم                                                                |
| Snap       | معرّف Pixel (UUID)                          | Ads Manager ← Events Manager ← Pixel                                                                            |
| Snap       | رمز Conversions API (خادمي)                 | Ads Manager ← Business Details ← Conversions API Tokens ← Generate Token (مدير المؤسسة وحده)                    |
| TikTok     | رمز Pixel                                   | Ads Manager ← الأدوات ← Events ← Web Events ← البكسل                                                            |
| TikTok     | رمز Events API (خادمي)                      | البكسل نفسه ← الإعدادات ← Events API ← «إنشاء رمز وصول»                                                         |
| TikTok     | رمز أحداث الاختبار                          | البكسل ← Test Events                                                                                            |
| X          | معرّف البكسل (خمسة محارف)                   | ads.x.com ← الأدوات ← Events Manager ← البكسل؛ وهو ما بين علامتي `twq('config','…')` في شيفرته الأساسية         |
| X          | معرّف حدث الشراء `tw-XXXXX-XXXXX` (مطلوب)   | Events Manager ← البكسل ← إضافة حدث «Purchase» بطريقة X Pixel ← المعرّف في شيفرة الحدث `twq('event','tw-…')`    |
| X          | معرّف حدث إضافة السلة (اختياري)             | المكان نفسه لحدث «Add to cart»                                                                                  |
| X          | معرّف حدث الاستفسار (اختياري)               | المكان نفسه لحدث «Lead»                                                                                         |

`[خارجي]` مسارات قوائم X من واجهة Ads Manager كما تُعرف، لا من صفحة رسمية مقروءة اليوم: يطابقها المالك بما يراه، والمعرّف نفسه يتحقق منه النموذج بنمطه.

## 9. الأداء

- **بلا تكامل مفعَّل:** لا مكوّن عميل جديد في الصفحة، ولا شريط، ولا CSP موسَّعة (اختبار e2e يعدّ طلبات الطرف الثالث: صفر).
- **مع تكامل:** محمّلات المنصات الأربع في قطعة تُحمَّل بعد الموافقة (3.4KB مضغوطة، مقيسة على البناء الإنتاجي)، والشريط ومحمّل الوسوم في قطع الصفحة؛ سكربتات المنصات `async` بعد الموافقة لا تحجب العرض الأول.

## 10. الاختبار

- **لا إرسال حقيقي في الاختبارات:** الناقل منفذ يُحقن (`TrackingTransport`)، والاختبارات تستعمل `fakeTransport` بسجل الطلبات. خادم e2e يعمل بـ`TRACKING_TRANSPORT=fake`، ويحجب المتصفح كل مضيف طرف ثالث (`page.route`).
- وحدة: أنماط المعرّفات، رموز الموافقة والإسناد، التطبيع والتجزئة (مثال Snap الرسمي)، بانيات الحمولة الأربع، جدول الإعادة، CSP لكل منصة، الصلاحيات.
- تكامل: الإدراج في التسوية مرة واحدة (والإعادة لا تكرر، والرفض لا يُدرج)، احترام الموافقة، الطلب اليدوي، الإرسال والإعادة والموت، `SKIP LOCKED`، تشفير المفتاح بالسياق.
- متصفح: الشريط (القبول والرفض والتخصيص والسحب)، لا طلب طرف ثالث قبل الموافقة، صفحة الربط (الحفظ، المفتاح للكتابة فقط، حدث الاختبار بالناقل الوهمي، السجل)، والحارس 404 لغير المصرَّح.

## 11. الحزم المنفَّذة

| الحزمة | المحتوى                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| WP1    | المجال: المنصات والمعرّفات والموافقة والإسناد والأحداث والإعادة والتطبيع         |
| WP2    | القاعدة: الترحيل، الإعداد، `order_tracking`، الإدراج في التسوية، الطابور         |
| WP3    | `packages/tracking`: الأسرار، البانيات، الناقل، المرسِل، أمر `tracking:dispatch` |
| WP4    | الموقع: CSP لكل منصة، كوكي الإسناد، الشريط، محمّل الوسوم والأحداث، صفحة الخصوصية |
| WP5    | الطلب: حفظ الموافقة والإسناد، ونسخة الشراء في صفحة الطلب المدفوع                 |
| WP6    | اللوحة: الصلاحيتان، الصفحتان، الإجراءات، السجل، التدقيق                          |
| WP7    | اختبارات المتصفح، اللقطات، الوثائق                                               |

## 12. خارج النطاق (بسبب)

- **Google Ads API الخادمي** (§4.3)، و**Enhanced Conversions for Leads**: يحتاجان حساب مطوّر وOAuth.
- **وسم الخادم (sGTM)** ونطاق قياس فرعي: بنية تحتية منفصلة بتكلفة شهرية؛ `[توصية]` لاحقًا إن قلّت المطابقة.
- **`refund` إلى المنصات:** لا مسار استرداد في المنصة بعد (`SECURITY.md` §6).
- ~~**حذف آلي لبيانات `order_tracking`**~~ بُني: تفريغ بعد 90 يومًا (§7.1، القرار 90-6).
- **X الخادمي** (§4.3، القرار 90-1): بانتظار قراءة وثيقة رمز البكسل الحالية كاملة.
