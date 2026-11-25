import { Fragment } from "react";

/**
 * كلمة لاتينية أو أكثر متصلة بمسافات أو نقطة أو شرطة أو +، مثل «Life Fitness» و«Boot Camp» و«BE STRONG 45».
 * تبدأ بحرف لاتيني فلا تلتقط الأرقام وحدها (الأرقام في الجملة العربية تُعرض صحيحة بلا عزل).
 */
const LATIN_RUN = /([A-Za-z][A-Za-z0-9]*(?:[ .+-][A-Za-z0-9]+)*)/;

/**
 * نص عربي فيه أسماء لاتينية: كل اسم في ‎<bdi>‎ معزول الاتجاه، فلا تنفصل عنه «و» ولا علامة الترقيم ولا تنقلب
 * الكلمات حوله. النص نفسه لا يتغير (قارئ الشاشة والنسخ يقرآنه كما هو).
 */
export function BidiText({ text }: { readonly text: string }) {
  const parts = text.split(LATIN_RUN);
  if (parts.length === 1) {
    return text;
  }
  return parts.map((part, index) =>
    // التقسيم بمجموعة التقاط: الأجزاء الفردية هي المطابقات اللاتينية
    index % 2 === 1 ? <bdi key={index}>{part}</bdi> : <Fragment key={index}>{part}</Fragment>,
  );
}
