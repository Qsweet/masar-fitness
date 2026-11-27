import { describe, expect, it } from "vitest";
import { chordLabels, chordTargets, isComposingKey, shortcutFor, type KeyInput } from "./shortcuts";

const key = (code: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  inField: false,
  dialogOpen: false,
  ...extra,
});
const on = { enabled: true, chordPending: false };

describe("مطابق الاختصارات بـevent.code", () => {
  it("⌘K وCtrl K يفتحان اللوحة في كل مكان، حتى داخل حقل ومع الاختصارات مطفأة", () => {
    const off = { enabled: false, chordPending: false };
    expect(shortcutFor(key("KeyK", { metaKey: true }), on)).toEqual({ kind: "palette" });
    expect(shortcutFor(key("KeyK", { ctrlKey: true, inField: true }), off)).toEqual({
      kind: "palette",
    });
    expect(shortcutFor(key("KeyK"), on)).toBeNull();
    expect(shortcutFor(key("KeyK", { ctrlKey: true, altKey: true }), on)).toBeNull();
  });

  it("الموضع لا الحرف: لوحة عربية تعطي الرمز نفسه («ن» على موضع K)", () => {
    // event.key على اللوحة العربية «ن»، والرمز KeyK: المطابق لا يقرأ event.key أصلًا
    expect(shortcutFor(key("KeyK", { ctrlKey: true }), on)?.kind).toBe("palette");
    expect(shortcutFor(key("BracketLeft"), on)).toEqual({ kind: "sidebar" });
  });

  it("G ثم حرف ينقل، وبلا G قبله لا شيء", () => {
    expect(shortcutFor(key("KeyG"), on)).toEqual({ kind: "chord" });
    const pending = { enabled: true, chordPending: true };
    expect(shortcutFor(key("KeyO"), pending)).toEqual({ kind: "go", target: "orders" });
    expect(shortcutFor(key("KeyH"), pending)).toEqual({ kind: "go", target: "overview" });
    expect(shortcutFor(key("KeyO"), on)).toBeNull();
    expect(shortcutFor(key("KeyX"), pending)).toBeNull();
  });

  it("/ للبحث، و? (Shift+/) للمساعدة", () => {
    expect(shortcutFor(key("Slash"), on)).toEqual({ kind: "search" });
    expect(shortcutFor(key("Slash", { shiftKey: true }), on)).toEqual({ kind: "help" });
  });

  it("لا اختصار بحرف داخل حقل، ولا مع مفاتيح التعديل، ولا حين تُطفأ", () => {
    expect(shortcutFor(key("Slash", { inField: true }), on)).toBeNull();
    expect(shortcutFor(key("KeyG", { metaKey: true }), on)).toBeNull();
    expect(shortcutFor(key("BracketLeft"), { enabled: false, chordPending: false })).toBeNull();
    // تحت حوار مفتوح لا حرف، و⌘K يبقى
    expect(shortcutFor(key("KeyG", { dialogOpen: true }), on)).toBeNull();
    expect(shortcutFor(key("KeyK", { ctrlKey: true, dialogOpen: true }), on)?.kind).toBe("palette");
  });
});

describe("وجهات G بحسب الأقسام المتاحة", () => {
  it("ما لا يراه الموظف لا وجهة له، والتسمية «G O»", () => {
    const targets = chordTargets([
      { key: "overview", href: "/admin" },
      { key: "orders", href: "/admin/sales/orders" },
      { key: "audit", href: "/admin/audit" },
    ]);
    expect(targets).toEqual({ overview: "/admin", orders: "/admin/sales/orders" });
    expect(chordLabels(targets)).toEqual({ "page:overview": "G H", "page:orders": "G O" });
  });
});

it("ضغطات التركيب بمحرر الإدخال لا تُعدّ اختصارًا", () => {
  expect(isComposingKey({ isComposing: true, key: "g" })).toBe(true);
  expect(isComposingKey({ isComposing: false, key: "Process" })).toBe(true);
  expect(isComposingKey({ isComposing: false, key: "g" })).toBe(false);
});
