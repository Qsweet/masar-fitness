// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://127.0.0.1/admin/sales/settings"}
import { act, createElement, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adminAr } from "@/i18n/admin/ar";
import { initialFieldForm } from "@/server/admin/field-form";
import { alignColumns } from "./data-table";
import { hasUnsaved } from "./field-form";
import { LeaveDialog } from "./leave-dialog";
import { focusedForm, isSaveShortcut, readySubmit, useSaveShortcut } from "./save-shortcut";
import { isFormDirty } from "./use-dirty-form";
import { internalHref } from "./use-leave-guard";

/** عدّة النماذج v2 (القرار 92) بمتصفح jsdom: التعديل، والرابط الداخلي، والاختصار، وتركيز الحوار. */
const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let root: Root | null = null;

beforeAll(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom بلا showModal: يحاكي المتصفح (يفتح ويركّز أول عنصر قابل للتركيز، وهو هنا «غادر بلا حفظ»)
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("button")?.focus();
  };
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
});

function mount(node: ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
  return container;
}

/** عنصر موجود حتمًا في الاختبار، وإلا يفشل باسمه. */
function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`missing ${what}`);
  }
  return value;
}

function field(element: HTMLFormElement, name: string): HTMLInputElement {
  return present(element.querySelector<HTMLInputElement>(`[name="${name}"]`), name);
}

function form(html: string): HTMLFormElement {
  const element = document.createElement("form");
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

describe("isFormDirty: المقارنة بالقيمة الأولى من الخادم", () => {
  it("النص والخانة والقائمة، والمخفي والمعطَّل لا يُحسبان", () => {
    const element = form(`
      <input name="a" value="30"><input type="checkbox" name="b">
      <select name="c"><option value="x" selected>x</option><option value="y">y</option></select>
      <input type="hidden" name="token" value="t"><input name="d" value="1" disabled>`);
    expect(isFormDirty(element)).toBe(false);
    const text = field(element, "a");
    const box = field(element, "b");
    const hidden = field(element, "token");
    const disabled = field(element, "d");
    hidden.value = "changed";
    disabled.value = "changed";
    expect(isFormDirty(element)).toBe(false);
    text.value = "45";
    expect(isFormDirty(element)).toBe(true);
    text.value = "30";
    box.checked = true;
    expect(isFormDirty(element)).toBe(true);
    box.checked = false;
    present(element.querySelector("select"), "select").value = "y";
    expect(isFormDirty(element)).toBe(true);
    element.reset();
    expect(isFormDirty(element)).toBe(false);
  });
});

function clickOn(link: HTMLAnchorElement, init: MouseEventInit = {}): string | null {
  let href: string | null = "unset";
  const listener = (event: MouseEvent) => {
    href = internalHref(event);
    event.preventDefault();
  };
  document.addEventListener("click", listener, true);
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  document.removeEventListener("click", listener, true);
  return href;
}

function link(href: string, attributes: Record<string, string> = {}): HTMLAnchorElement {
  const element = document.createElement("a");
  element.href = href;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.innerHTML = "<span>نص</span>";
  document.body.append(element);
  return element;
}

describe("internalHref: ما يعترضه حارس المغادرة", () => {
  it("رابط داخلي لصفحة أخرى بنقرة عادية، ومن عنصر داخل الرابط", () => {
    expect(clickOn(link("/admin/audit?page=2#top"))).toBe("/admin/audit?page=2#top");
  });

  it("لا يعترض: الصفحة نفسها، ونطاق آخر، ونافذة جديدة، وتنزيل، ومفتاح تعديل، وزر غير الأيسر", () => {
    expect(clickOn(link("/admin/sales/settings#field"))).toBeNull();
    expect(clickOn(link("https://example.test/admin"))).toBeNull();
    expect(clickOn(link("/admin/audit", { target: "_blank" }))).toBeNull();
    expect(clickOn(link("/admin/audit", { download: "" }))).toBeNull();
    expect(clickOn(link("/admin/audit"), { metaKey: true })).toBeNull();
    expect(clickOn(link("/admin/audit"), { shiftKey: true })).toBeNull();
    expect(clickOn(link("/admin/audit"), { button: 1 })).toBeNull();
  });
});

describe("alignColumns", () => {
  it("بترتيب القاموس، والمفاتيح الرقمية بمحاذاة النهاية", () => {
    expect(alignColumns({ name: "الاسم", total: "الإجمالي", at: "الوقت" }, ["total"])).toEqual([
      "الاسم",
      { label: "الإجمالي", align: "numeric" },
      "الوقت",
    ]);
  });
});

describe("اختصار الحفظ", () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", { code: "KeyS", ...init });

  it("⌘S وCtrl+S وحدهما: لا Shift ولا Alt ولا أثناء التركيب ولا حرف آخر", () => {
    expect(isSaveShortcut(key({ metaKey: true }))).toBe(true);
    expect(isSaveShortcut(key({ ctrlKey: true }))).toBe(true);
    expect(isSaveShortcut(key({}))).toBe(false);
    expect(isSaveShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isSaveShortcut(key({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isSaveShortcut(key({ ctrlKey: true, isComposing: true }))).toBe(false);
    expect(isSaveShortcut(new KeyboardEvent("keydown", { code: "KeyD", ctrlKey: true }))).toBe(
      false,
    );
  });

  it("النموذج الذي فيه التركيز، والزر الجاهز فقط", () => {
    const element = form('<input name="a"><button type="submit">احفظ</button>');
    const button = present(element.querySelector("button"), "button");
    expect(focusedForm(element.querySelector("input"))).toBe(element);
    expect(focusedForm(document.body)).toBeNull();
    expect(readySubmit(element)).toBe(button);
    button.dataset.pending = "true";
    expect(readySubmit(element)).toBeNull();
    button.dataset.pending = "false";
    button.disabled = true;
    expect(readySubmit(element)).toBeNull();
  });

  function Bar({ id }: { readonly id: string }) {
    const bar = useRef<HTMLDivElement>(null);
    useSaveShortcut(bar, true);
    return createElement(
      "form",
      { id },
      createElement("input", { id: `${id}-field` }),
      createElement(
        "div",
        { ref: bar },
        createElement("button", { type: "submit", name: "intent", value: "save" }, "احفظ"),
      ),
    );
  }

  it("في صفحة بنموذجين يرسل نموذج التركيز وحده، ولا شيء والتركيز خارجهما", () => {
    mount(
      createElement(
        "div",
        null,
        createElement(Bar, { id: "one" }),
        createElement(Bar, { id: "two" }),
      ),
    );
    const submitted: string[] = [];
    document.addEventListener("submit", (event) => {
      event.preventDefault();
      submitted.push((event.target as HTMLFormElement).id);
    });
    const press = () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyS", ctrlKey: true, bubbles: true }),
      );
    present(document.getElementById("two-field"), "two-field").focus();
    press();
    expect(submitted).toEqual(["two"]);
    (document.activeElement as HTMLElement).blur();
    press();
    expect(submitted).toEqual(["two"]);
  });
});

describe("حوار المغادرة", () => {
  it("يفتح والتركيز على «ابقَ هنا» لا على «غادر بلا حفظ»، و«غادر» يسلّم الرابط", () => {
    const onLeave = vi.fn();
    mount(
      createElement(LeaveDialog, {
        href: "/admin/audit",
        text: adminAr.kit.leave,
        onStay: vi.fn(),
        onLeave,
      }),
    );
    expect(document.activeElement?.textContent).toBe(adminAr.kit.leave.stay);
    const leave = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === adminAr.kit.leave.leave,
    );
    act(() => {
      leave?.click();
    });
    expect(onLeave).toHaveBeenCalledWith("/admin/audit");
  });
});

describe("hasUnsaved: ما أُرسل ولم يُحفظ يبقي الحارس", () => {
  const saved = initialFieldForm({ windowMinutes: "30" });

  it("بعد الحفظ أو قبل أي إرسال: لا شيء معلَّق", () => {
    expect(hasUnsaved(saved)).toBe(false);
  });

  it("خطوة «راجع»، وخطأ النموذج، وخطأ حقل: معلَّق وإن رُسمت الحقول بما أُرسل", () => {
    expect(hasUnsaved({ ...saved, step: "confirm" })).toBe(true);
    expect(hasUnsaved({ ...saved, error: "sales_settings.stale" })).toBe(true);
    expect(
      hasUnsaved({ ...saved, fields: { windowMinutes: "sales_settings.window_invalid" } }),
    ).toBe(true);
  });
});
