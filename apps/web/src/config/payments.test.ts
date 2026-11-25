import { describe, expect, it } from "vitest";
import { isLoopbackHost, parsePayNotice } from "./payments";

describe("isLoopbackHost", () => {
  it.each(["127.0.0.1", "127.0.0.1:3102", "localhost", "localhost:3000", "[::1]", "[::1]:3000"])(
    "عنوان الجهاز نفسه: %s",
    (host) => {
      expect(isLoopbackHost(host)).toBe(true);
    },
  );

  it.each([
    null,
    "",
    "preview.example.com",
    "localhost.example.com",
    "127.0.0.1.example.com",
    "example.com:127",
    "10.0.0.5",
    "localhost@evil.example",
    "evil.example/127.0.0.1",
  ])("غيره مرفوض: %s", (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });
});

describe("parsePayNotice", () => {
  it("قائمة مغلقة", () => {
    expect(parsePayNotice("failed")).toBe("failed");
    expect(parsePayNotice("throttled")).toBe("throttled");
    for (const value of [undefined, "", "paid", ["failed"], "<script>"]) {
      expect(parsePayNotice(value)).toBeNull();
    }
  });
});
