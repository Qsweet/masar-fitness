"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button-link";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { CONSENT_OPEN, readConsent, saveConsent } from "./consent-cookie";
import styles from "./consent-banner.module.css";

interface ConsentBannerProps {
  readonly copy: Dictionary["consent"];
  /** أسماء الجهات المفعّلة منسَّقة بلغة الصفحة («Google وMeta»). */
  readonly providers: string;
  readonly privacyHref: string;
  /** لا موافقة صالحة على النص الحالي: يظهر عند أول زيارة. */
  readonly initiallyOpen: boolean;
}

interface Choice {
  readonly analytics: boolean;
  readonly ads: boolean;
}

const NONE: Choice = { analytics: false, ads: false };

function Category({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly hint: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={styles.category}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          onChange?.(event.currentTarget.checked);
        }}
      />
      <label htmlFor={id} className={styles.categoryLabel}>
        {label}
      </label>
      <span id={`${id}-hint`} className={styles.hint}>
        {hint}
      </span>
    </div>
  );
}

interface ActionsProps {
  readonly copy: Dictionary["consent"];
  readonly customizing: boolean;
  readonly choice: Choice;
  readonly decide: (choice: Choice) => void;
  readonly customize: () => void;
}

/** الأزرار الثلاثة بالوزن نفسه: الرفض بنقرة كالقبول. */
function Actions({ copy, customizing, choice, decide, customize }: ActionsProps) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={buttonClass("primary")}
        onClick={() => {
          decide({ analytics: true, ads: true });
        }}
      >
        {copy.acceptAll}
      </button>
      <button
        type="button"
        className={buttonClass("outline")}
        onClick={() => {
          decide(NONE);
        }}
      >
        {copy.rejectAll}
      </button>
      <button
        type="button"
        className={buttonClass("outline")}
        onClick={() => {
          if (customizing) {
            decide(choice);
          } else {
            customize();
          }
        }}
      >
        {customizing ? copy.save : copy.customize}
      </button>
    </div>
  );
}

function Categories({
  copy,
  choice,
  onChange,
}: {
  readonly copy: Dictionary["consent"];
  readonly choice: Choice;
  readonly onChange: (choice: Choice) => void;
}) {
  return (
    <fieldset className={styles.categories}>
      <legend className={styles.legend}>{copy.categoriesLegend}</legend>
      <Category {...copy.categories.necessary} checked disabled />
      <Category
        {...copy.categories.analytics}
        checked={choice.analytics}
        onChange={(analytics) => {
          onChange({ ...choice, analytics });
        }}
      />
      <Category
        {...copy.categories.ads}
        checked={choice.ads}
        onChange={(ads) => {
          onChange({ ...choice, ads });
        }}
      />
    </fieldset>
  );
}

/**
 * شريط الموافقة (ADMIN_A5_TRACKING §3): ثلاثة أزرار بالوزن نفسه، والرفض بنقرة كالقبول، ولا خانة مختارة
 * مسبقًا. يُفتح من رابط «إعدادات الخصوصية» في التذييل في أي وقت، باختيار الزائر الحالي.
 */
export function ConsentBanner({ copy, providers, privacyHref, initiallyOpen }: ConsentBannerProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [customizing, setCustomizing] = useState(false);
  const [choice, setChoice] = useState<Choice>(NONE);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const reopen = () => {
      const current = readConsent();
      setChoice(current === null ? NONE : { analytics: current.analytics, ads: current.ads });
      setCustomizing(true);
      setOpen(true);
      window.requestAnimationFrame(() => heading.current?.focus());
    };
    window.addEventListener(CONSENT_OPEN, reopen);
    return () => {
      window.removeEventListener(CONSENT_OPEN, reopen);
    };
  }, []);

  if (!open) {
    return null;
  }
  const decide = (next: Choice) => {
    saveConsent(next);
    setOpen(false);
  };
  return (
    <section className={styles.banner} aria-labelledby={titleId} data-testid="consent-banner">
      <h2 id={titleId} ref={heading} tabIndex={-1} className={styles.title}>
        {copy.title}
      </h2>
      <p className={styles.lead}>
        {fill(copy.lead, { providers })} <a href={privacyHref}>{copy.privacyLink}</a>
      </p>
      {customizing ? <Categories copy={copy} choice={choice} onChange={setChoice} /> : null}
      <Actions
        copy={copy}
        customizing={customizing}
        choice={choice}
        decide={decide}
        customize={() => {
          setCustomizing(true);
        }}
      />
    </section>
  );
}
