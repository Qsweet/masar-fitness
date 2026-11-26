import { IssueList, parseWholeNumber, singleLine, type Validated } from "../../field-input";
import { err, ok } from "../../result";
import { MEMBERSHIP_START_RULES, type MembershipStartRule } from "../lifecycle";

/** حد إدخال تقني (لا قاعدة عمل): ثلاثون يومًا بالدقائق، فلا يفيض حساب المهلة. */
export const MAX_PAYMENT_WINDOW_MINUTES = 43_200;

export interface SalesSettings {
  /** مهلة الطلب غير المدفوع بالدقائق؛ null = لم يحسمها المالك، فلا يُنشأ أي طلب. */
  readonly orderPaymentWindowMinutes: number | null;
  /** متى يبدأ الاشتراك؛ null = لم يحسمها المالك، فلا يُنشأ طلب اشتراك. */
  readonly membershipStartRule: MembershipStartRule | null;
}

export interface SalesSettingsInput {
  readonly windowMinutes: string;
  readonly startRule: string;
}

export interface SalesSettingsContext {
  readonly current: SalesSettings;
  /**
   * أقل مهلة يقبلها مزوّد الدفع المضبوط (أقل وقت للدفع مع هامش جلسة المزوّد)، أو null بلا مزوّد.
   * مهلة أقصر منها تجعل كل محاولة دفع مرفوضة.
   */
  readonly minimumWindowMinutes: number | null;
}

function parseWindow(
  issues: IssueList,
  text: string,
  context: SalesSettingsContext,
): number | null {
  if (singleLine(text) === "") {
    if (context.current.orderPaymentWindowMinutes !== null) {
      issues.add("windowMinutes", "sales_settings.cannot_unset");
    }
    return null;
  }
  const value = parseWholeNumber(text);
  if (value === null || value < 1 || value > MAX_PAYMENT_WINDOW_MINUTES) {
    issues.add("windowMinutes", "sales_settings.window_invalid");
    return null;
  }
  if (context.minimumWindowMinutes !== null && value < context.minimumWindowMinutes) {
    issues.add("windowMinutes", "sales_settings.window_below_provider_minimum");
  }
  return value;
}

function parseStartRule(
  issues: IssueList,
  text: string,
  context: SalesSettingsContext,
): MembershipStartRule | null {
  if (text === "") {
    if (context.current.membershipStartRule !== null) {
      issues.add("startRule", "sales_settings.cannot_unset");
    }
    return null;
  }
  const rule = MEMBERSHIP_START_RULES.find((candidate) => candidate === text);
  if (rule === undefined) {
    issues.add("startRule", "sales_settings.start_rule_invalid");
    return null;
  }
  return rule;
}

/**
 * إعدادات البيع كما تُحفظ. بلا قيمة افتراضية: الحقل الفارغ يبقى «غير محسوم» (والشراء مغلقًا به)، وما
 * حُسم لا يعود فارغًا من هنا. المهلة عدد صحيح موجب بالدقائق، ولا تقل عن أدنى ما يقبله مزوّد الدفع.
 */
export function validateSalesSettings(
  input: SalesSettingsInput,
  context: SalesSettingsContext,
): Validated<SalesSettings> {
  const issues = new IssueList();
  const settings: SalesSettings = {
    orderPaymentWindowMinutes: parseWindow(issues, input.windowMinutes, context),
    membershipStartRule: parseStartRule(issues, input.startRule, context),
  };
  return issues.empty ? ok(settings) : err(issues.all);
}
