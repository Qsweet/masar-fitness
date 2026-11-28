/**
 * طلبات المغادرة من خارج الروابط (لوحة الأوامر، اختصارات «G ثم حرف»): ما دام نموذج متغيّر يحرس الصفحة،
 * يُسلَّم له الرابط المطلوب ليعرض حوار المغادرة بدل التنقل مباشرة. بلا React، فيستعمله الهيكل والعدّة.
 */
export const LEAVE_REQUEST_EVENT = "masar:leave-request";

let guards = 0;

/** يسجّل حارسًا نشطًا؛ ويرجع ما يرفعه. */
export function holdLeaveGuard(): () => void {
  guards += 1;
  return () => {
    guards -= 1;
  };
}

/** true: لا حارس، فليتابع المستدعي التنقل. false: أخذ الحارس الطلب وسيسأل الموظف. */
export function requestLeave(href: string): boolean {
  if (guards === 0) {
    return true;
  }
  window.dispatchEvent(new CustomEvent<string>(LEAVE_REQUEST_EVENT, { detail: href }));
  return false;
}
