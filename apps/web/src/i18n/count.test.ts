import { describe, expect, it } from "vitest";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import { countText } from "./count";
import { formatDate } from "./dates";

describe("countText", () => {
  it("العربية: الواحد والاثنان بلا رقم، ثم الجمع، ثم التمييز المفرد", () => {
    const forms = ar.blog.minutes;
    expect([1, 2, 3, 10, 11].map((n) => countText(n, forms))).toEqual([
      "دقيقة",
      "دقيقتان",
      "3 دقائق",
      "10 دقائق",
      "11 دقيقة",
    ]);
  });

  it("الإنجليزية: once وtwice ثم العدد", () => {
    const forms = en.tools.costPerVisit.times;
    expect([1, 2, 7].map((n) => countText(n, forms))).toEqual(["once", "twice", "7 times"]);
  });
});

describe("formatDate", () => {
  it("ميلادي بأرقام لاتينية في اللغتين، بلا زحف يوم", () => {
    expect(formatDate("2026-11-25", "ar")).toBe("25 نوفمبر 2026");
    expect(formatDate("2026-01-01", "en")).toBe("1 January 2026");
  });
});
