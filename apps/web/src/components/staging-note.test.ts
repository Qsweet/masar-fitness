import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StagingNote } from "./staging-note";

function render(rawIndexable: string | undefined): string {
  return renderToStaticMarkup(createElement(StagingNote, { rawIndexable, text: "نسخة معاينة" }));
}

describe("StagingNote", () => {
  it("يظهر على النطاق المؤقت: العلم غائب أو أي قيمة غير true", () => {
    for (const raw of [undefined, "", "false", "TRUE", "1"]) {
      expect(render(raw), String(raw)).toContain("نسخة معاينة");
    }
  });

  it("لا يظهر على الموقع الرسمي (SITE_INDEXABLE=true)", () => {
    expect(render("true")).toBe("");
  });
});
