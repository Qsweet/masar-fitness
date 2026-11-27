import { ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffContext } from "../session";

/** حفظ نصوص مساحة (ADMIN_A3_CONTENT §3.3، WP3) بقاعدة مستبدلة: ما يُكتب، والرفض بأسبابه، والصلاحية. */
const NOW = new Date("2026-11-28T09:00:00Z");
const saveDraftEntries = vi.fn(() => Promise.resolve(ok(1)));
const rows: {
  key: string;
  locale: string;
  value: { value: string; baseHash: string } | null;
  lockToken: string;
}[] = [];
class DraftConflict extends Error {
  constructor(readonly stale: readonly string[]) {
    super("conflict");
  }
}
vi.mock("@masar/db", () => ({
  listDraftEntries: () => Promise.resolve(rows),
  latestRelease: () => Promise.resolve(null),
  findRelease: () => Promise.resolve(null),
  saveDraftEntries,
  staffActor: (id: string) => `staff:${id}`,
  DraftConflict,
}));
vi.mock("../../db", () => ({ getDb: () => ({}) }));

const { saveNamespaceTexts, tokenField, valueField } = await import("./save-texts");
const { textRegistry } = await import("../../content/registry");

function context(role: string): StaffContext {
  return { staff: { id: "s1", clubId: "c1", role } } as unknown as StaffContext;
}

function save(
  values: Record<string, string>,
  role = "editor",
  namespace = "hero",
  revert: string | null = null,
) {
  return saveNamespaceTexts(context(role), { namespace, values, tokens: {}, revert }, NOW);
}

afterEach(() => {
  vi.clearAllMocks();
  rows.length = 0;
});

describe("saveNamespaceTexts", () => {
  it("يكتب ما تغيّر وحده، بقيمة منظَّفة وبصمة الافتراضي، ومع المساحة للتدقيق", async () => {
    const result = await save({
      [valueField("ar", "hero.title")]: " عنوان جديد ",
      [valueField("en", "hero.title")]: "The strongest version of you",
    });
    expect(result).toEqual({ ok: true, saved: 1 });
    const hash = textRegistry().editable.get("hero.title")?.defaultHash.ar;
    expect(saveDraftEntries).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        target: "hero",
        changes: [
          {
            key: "text:hero.title",
            locale: "ar",
            value: { value: "عنوان جديد", baseHash: hash },
            lockToken: "",
          },
        ],
      }),
    );
  });

  it("كل الأخطاء معًا بجانب حقولها، ولا كتابة", async () => {
    const result = await save({
      [valueField("ar", "hero.title")]: "",
      [valueField("ar", "hero.offerWith")]: "مع اشتراك",
      [valueField("en", "hero.lead")]: "Bad , spacing",
      [valueField("ar", "hero.place")]: "أ".repeat(3000),
    });
    expect(result).toEqual({
      ok: false,
      failure: {
        error: null,
        fields: {
          [valueField("ar", "hero.place")]: "content.too_long",
          [valueField("ar", "hero.title")]: "content.empty",
          [valueField("en", "hero.lead")]: "content.copy_lint",
          [valueField("ar", "hero.offerWith")]: "content.placeholder_missing",
        },
        fieldDetails: {
          [valueField("ar", "hero.place")]: "90",
          [valueField("en", "hero.lead")]: "مسافة قبل علامة الترقيم: «Bad , spacing»",
          [valueField("ar", "hero.offerWith")]: "{term}",
        },
      },
    });
    expect(saveDraftEntries).not.toHaveBeenCalled();
  });

  it("لا تغيير ⇒ لا كتابة، والمساوي للافتراضي بلا تجاوز قائم لا يُكتب", async () => {
    const result = await save({ [valueField("ar", "hero.title")]: "أقوى نسخة منك" });
    expect(result).toEqual({ ok: false, failure: { error: "content.no_changes", fields: {} } });
  });

  it("العودة إلى الافتراضي تكتب null برمز الصف وتحفظ معها ما كُتب في غيره", async () => {
    rows.push({
      key: "text:hero.title",
      locale: "ar",
      value: { value: "قديم", baseHash: "h" },
      lockToken: "42",
    });
    await saveNamespaceTexts(
      context("editor"),
      {
        namespace: "hero",
        values: {
          [valueField("ar", "hero.title")]: "قديم",
          [valueField("ar", "hero.slogan")]: "تبدأ الآن.",
        },
        tokens: { [tokenField("ar", "hero.title")]: "42" },
        revert: "ar:hero.title",
      },
      NOW,
    );
    expect(saveDraftEntries).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        changes: [
          { key: "text:hero.title", locale: "ar", value: null, lockToken: "42" },
          expect.objectContaining({ key: "text:hero.slogan", locale: "ar" }),
        ],
      }),
    );
  });

  it("حقائق النادي لا يكتبها المحرر ولو أُرسلت، ويكتبها المدير", async () => {
    const values = { [valueField("ar", "club.name")]: "اسم آخر للنادي" };
    expect(await save(values, "editor", "club")).toEqual({
      ok: false,
      failure: { error: "content.no_changes", fields: {} },
    });
    expect(await save(values, "manager", "club")).toEqual({ ok: true, saved: 1 });
  });

  it("رمز قديم ⇒ خطأ «عدّله غيرك» على الحقل نفسه", async () => {
    saveDraftEntries.mockResolvedValueOnce({
      ok: false,
      error: new DraftConflict(["text:hero.title|en"]),
    } as never);
    const result = await save({ [valueField("en", "hero.title")]: "Stronger" });
    expect(result).toEqual({
      ok: false,
      failure: { error: null, fields: { [valueField("en", "hero.title")]: "content.stale_edit" } },
    });
  });
});
