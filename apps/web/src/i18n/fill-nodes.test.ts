import { describe, expect, it } from "vitest";
import { fillNodes } from "./fill";

describe("fillNodes", () => {
  it("يستبدل المفاتيح بقيم من أي نوع ويبقي النص بينها", () => {
    const marker = { node: "publisher" };
    expect(fillNodes("{publisher}، {year}.", { publisher: marker, year: "2024" })).toEqual([
      marker,
      "، ",
      "2024",
      ".",
    ]);
  });

  it("المفتاح غير الموجود يبقى كما هو", () => {
    expect(fillNodes("a {missing} b", {})).toEqual(["a ", "{missing}", " b"]);
  });
});
