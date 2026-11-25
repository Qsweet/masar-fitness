import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";

type ContactCopy = Dictionary["contact"];
type InterestKey = keyof ContactCopy["interests"];

/** قراءة حقل نصي من النموذج بلا مسافات الأطراف؛ الحقل الغائب نص فارغ. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function interestLabel(key: string, copy: ContactCopy): string {
  return Object.hasOwn(copy.interests, key) ? copy.interests[key as InterestKey] : "";
}

/** الرسالة الجاهزة لواتساب: سطر لكل حقل مملوء فقط، بنصوص القاموس. */
export function composeMessage(form: FormData, copy: ContactCopy): string {
  const name = field(form, "name");
  const interest = interestLabel(field(form, "interest"), copy);
  const mobile = field(form, "mobile");
  const lines = [
    name === "" ? "" : fill(copy.compose.greeting, { name }),
    interest === "" ? "" : fill(copy.compose.interest, { interest }),
    mobile === "" ? "" : fill(copy.compose.mobile, { mobile }),
    field(form, "message"),
  ];
  return lines.filter((line) => line !== "").join("\n");
}
