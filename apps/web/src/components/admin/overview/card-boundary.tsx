"use client";

import { Component, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { uiStyles as ui } from "../ui/ui-styles";

interface CardBoundaryProps {
  readonly message: string;
  readonly children: ReactNode;
}

/**
 * حد خطأ لبطاقة واحدة في «نظرة عامة» (ADMIN_REDESIGN §6.3): استعلام فشل يُسقط بطاقته وحدها برسالة عامة
 * (التفاصيل في سجل الخادم)، وتبقى بقية الصفحة.
 */
export class CardBoundary extends Component<CardBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? (
      <p role="alert" className={cx(ui.alert, ui.alertWarning)}>
        {this.props.message}
      </p>
    ) : (
      this.props.children
    );
  }
}
