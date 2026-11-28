import buttons from "./buttons.module.css";
import feedback from "./feedback.module.css";
import forms from "./forms.module.css";
import page from "./page.module.css";
import base from "./ui.module.css";

/**
 * أصناف عدّة اللوحة مجموعةً في كائن واحد: الملفات مقسّمة بالموضوع (أزرار، نماذج، تنبيهات، رأس الصفحة،
 * بطاقات)، وأسماء الأصناف لا تتكرر بينها، فيبقى لكل مكوّن ومستورد اسم واحد.
 */
export const uiStyles: Readonly<Record<string, string>> = {
  ...buttons,
  ...forms,
  ...feedback,
  ...page,
  ...base,
};
