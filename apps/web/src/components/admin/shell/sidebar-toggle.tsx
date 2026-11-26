"use client";

import { useState } from "react";
import {
  ADMIN_NAV_COLLAPSED,
  ADMIN_NAV_COOKIE,
  ADMIN_NAV_EXPANDED,
  ADMIN_PATH,
  ADMIN_PREFERENCE_MAX_AGE,
} from "@/config/admin";
import { AdminIcon } from "../admin-icon";
import { COLLAPSED_ATTRIBUTE, SHELL_ATTRIBUTE } from "./attributes";
import styles from "./shell.module.css";

interface SidebarToggleProps {
  readonly initiallyCollapsed: boolean;
  readonly labels: { readonly collapse: string; readonly expand: string };
}

function remember(collapsed: boolean): void {
  const value = collapsed ? ADMIN_NAV_COLLAPSED : ADMIN_NAV_EXPANDED;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ADMIN_NAV_COOKIE}=${value}; Path=${ADMIN_PATH}; Max-Age=${String(ADMIN_PREFERENCE_MAX_AGE)}; SameSite=Lax${secure}`;
}

/**
 * طيّ الشريط الجانبي وبسطه. الحالة سمة على عنصر الهيكل (يرسمها الخادم من الكوكي، فلا وميض)، والضغط
 * يبدّلها فورًا ويحفظها في الكوكي للتحميل التالي. بلا JavaScript يبقى الشريط كما رسمه الخادم.
 */
export function SidebarToggle({ initiallyCollapsed, labels }: SidebarToggleProps) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const label = collapsed ? labels.expand : labels.collapse;
  return (
    <button
      type="button"
      className={styles.collapse}
      aria-expanded={!collapsed}
      onClick={(event) => {
        const next = !collapsed;
        event.currentTarget
          .closest(`[${SHELL_ATTRIBUTE}]`)
          ?.toggleAttribute(COLLAPSED_ATTRIBUTE, next);
        remember(next);
        setCollapsed(next);
      }}
    >
      <AdminIcon name="panel" />
      <span className={styles.navText}>{label}</span>
    </button>
  );
}
