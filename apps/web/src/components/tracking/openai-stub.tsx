/**
 * طابور `oaiq` من شيفرة OpenAI الأساسية الرسمية (https://developers.openai.com/ads/measurement-pixel):
 * الدالة تدفع كائن `arguments` نفسه إلى `q.q` كما في الشيفرة، والسكربت يفرّغه عند وصوله. هنا التعريف
 * وحده بلا تحميل ولا إرسال، فوجوده قبل الموافقة لا يخالف §3.2-3؛ السكربت يُحمَّل بعد موافقة الإعلانات
 * (`vendors/openai.ts`). بالـnonce، ويُرسم حين تُفعَّل OpenAI فقط. نص ثابت في الكود.
 */
const OAIQ_STUB =
  "(function(w){if(w.oaiq)return;var q=function(){q.q.push(arguments);};q.q=[];w.oaiq=q;})(window);";

export function OpenaiStub({ nonce }: { readonly nonce: string | undefined }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: OAIQ_STUB }} />;
}
