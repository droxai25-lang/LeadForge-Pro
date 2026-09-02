import { describe, expect, it } from "vitest";
import { normalizeSingleLineText } from "../src/lib/plainText";

describe("normalizeSingleLineText", () => {
  it("removes control characters and collapses whitespace", () => {
    expect(normalizeSingleLineText("  Alpha\u0000\tBeta\r\nGamma\u007f  ")).toBe("Alpha Beta Gamma");
  });

  it("preserves visible Unicode text", () => {
    expect(normalizeSingleLineText("  Café   HVAC — Dallas  ")).toBe("Café HVAC — Dallas");
  });
});
