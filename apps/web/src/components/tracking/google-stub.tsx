/**
 * شيفرة Google الأساسية لـ`dataLayer` و`gtag` كما في وثيقة Consent Mode
 * (https://developers.google.com/tag-platform/security/guides/consent): تعريف دالة لا يحمّل شيئًا ولا
 * يرسل شيئًا، فوجوده قبل الموافقة لا يخالف §3.2-3. بالـnonce، وتُرسم حين تُفعَّل منصة Google فقط.
 * نص ثابت في الكود، لا قيمة من القاعدة ولا من الزائر.
 */
const GTAG_STUB =
  "window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function gtag(){window.dataLayer.push(arguments);};";

export function GoogleStub({ nonce }: { readonly nonce: string | undefined }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: GTAG_STUB }} />;
}
