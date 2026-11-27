"use client";

import { useId, type SubmitEvent } from "react";
import { buttonClass } from "@/components/ui/button-link";
import { newEventId, track } from "@/components/tracking/track";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n/dictionaries";
import { composeMessage } from "./contact-message";
import styles from "./contact.module.css";

/** حدود طول الحقول: تكفي اسمًا ورقمًا ورسالة قصيرة، وتمنع رابط واتساب طويلًا بلا داعٍ. */
const MAX_NAME = 80;
const MAX_MOBILE = 20;
const MAX_MESSAGE = 600;
const MESSAGE_ROWS = 4;

interface ContactFormProps {
  readonly copy: Dictionary["contact"];
  /** رقم واتساب النادي بلا رموز (wa.me) */
  readonly whatsappNumber: string;
  /** رابط واتساب برسالة عامة: البديل الظاهر دائمًا، ووحيدًا بلا JavaScript */
  readonly fallbackHref: string;
}

/** الحقول: الاسم والجوال (اختياري)، والاهتمام، والرسالة (اختيارية). */
function Fields({ copy }: Pick<ContactFormProps, "copy">) {
  return (
    <>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>{copy.name}</span>
          <input name="name" required autoComplete="name" maxLength={MAX_NAME} />
        </label>
        <label className={styles.field}>
          <span>
            {copy.mobile} <span className={styles.optional}>{copy.optional}</span>
          </span>
          <input
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={MAX_MOBILE}
            dir="ltr"
          />
        </label>
      </div>
      <label className={styles.field}>
        <span>{copy.interest}</span>
        <select name="interest" required defaultValue="">
          <option value="" disabled>
            {copy.choose}
          </option>
          {Object.entries(copy.interests).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>
          {copy.message} <span className={styles.optional}>{copy.optional}</span>
        </span>
        <textarea name="message" rows={MESSAGE_ROWS} maxLength={MAX_MESSAGE} />
      </label>
    </>
  );
}

/**
 * نموذج الاستفسار: لا يُخزَّن شيء ولا يُرسل لطرف ثالث. عند الإرسال يُفتح واتساب برسالة جاهزة يرسلها الزائر
 * بنفسه. ‎method="dialog"‎ خارج نافذة حوار لا يرسل شيئًا، فبلا JavaScript لا تذهب البيانات إلى أي عنوان
 * (ولا تظهر في سجلات الخادم)، ويبقى رابط واتساب المباشر تحته.
 */
export function ContactForm({ copy, whatsappNumber, fallbackHref }: ContactFormProps) {
  const id = useId();

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = composeMessage(data, copy);
    // نوع الاهتمام وحده (قائمة مغلقة)، لا شيء مما كُتب: يُرسل فقط إن وافق الزائر وفُعّلت منصة
    const interest = data.get("interest");
    track("generate_lead", {
      eventId: newEventId(),
      ...(typeof interest === "string" && Object.hasOwn(copy.interests, interest)
        ? { interest }
        : {}),
    });
    window.location.assign(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`);
  }

  return (
    <form
      method="dialog"
      className={styles.form}
      onSubmit={onSubmit}
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`} className="title-block">
        {copy.formTitle}
      </h3>
      <Fields copy={copy} />
      <button type="submit" className={buttonClass("primary", true)}>
        <Icon name="chat" />
        {copy.submit}
      </button>
      <p className={styles.privacy}>{copy.privacy}</p>
      <p className={styles.fallback}>
        <a href={fallbackHref} rel="noopener noreferrer">
          {copy.direct}
        </a>
      </p>
    </form>
  );
}
