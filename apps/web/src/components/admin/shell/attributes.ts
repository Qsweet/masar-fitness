/**
 * سمات العناصر التي تبحث عنها مكوّنات المتصفح الصغيرة في الهيكل. في ملف بلا "use client": الثابت
 * المستورد من وحدة عميل إلى مكوّن خادم مرجع لا قيمة.
 */
export const SHELL_ATTRIBUTE = "data-admin-shell";
export const COLLAPSED_ATTRIBUTE = "data-collapsed";
export const MENU_ATTRIBUTE = "data-admin-menu";
/** حدث نافذة يفتح به زرٌّ في الهيكل لوحة الأوامر أو حوار الاختصارات (`detail`: أيهما). */
export const COMMAND_EVENT = "masar:admin-command";
export type ShellCommand = "palette" | "help";
/** حقل البحث في الصفحة الذي يركّز عليه `/` (بحث الطلبات بالمرجع، والعملاء بالجوال، والنصوص). */
export const PAGE_SEARCH_ATTRIBUTE = "data-admin-search";
/** زر طي الشريط الجانبي: يضغطه اختصار `[`. */
export const COLLAPSE_ATTRIBUTE = "data-admin-collapse";
