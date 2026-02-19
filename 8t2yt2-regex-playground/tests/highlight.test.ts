import { buildHighlightLayout } from "../repository_after/src/utils/highlight";

describe("buildHighlightLayout", () => {
  it("returns single unhighlighted token for empty text", () => {
    const result = buildHighlightLayout("", []);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toEqual({
      type: "text",
      text: "",
      activeCount: 0,
    });
  });

  it("returns single unhighlighted token when no ranges", () => {
    const result = buildHighlightLayout("hello", []);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toEqual({
      type: "text",
      text: "hello",
      activeCount: 0,
    });
  });

  it("returns single unhighlighted token when text is empty but ranges given", () => {
    const result = buildHighlightLayout("", [{ start: 0, end: 1 }]);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toEqual({
      type: "text",
      text: "",
      activeCount: 0,
    });
  });

  it("highlights a single range with activeCount 1", () => {
    const result = buildHighlightLayout("abcdef", [{ start: 1, end: 4 }]);
    const textTokens = result.tokens.filter((t) => t.type === "text");
    expect(textTokens.map((t) => (t.type === "text" ? t.text : ""))).toEqual([
      "a",
      "bcd",
      "ef",
    ]);
    expect(textTokens.map((t) => (t.type === "text" ? t.activeCount : 0))).toEqual([
      0,
      1,
      0,
    ]);
  });

  it("handles overlapping ranges with activeCount 2 in overlap", () => {
    const result = buildHighlightLayout("ababa", [
      { start: 0, end: 3 },
      { start: 2, end: 5 },
    ]);
    const textTokens = result.tokens.filter((t) => t.type === "text");
    expect(textTokens.map((t) => (t.type === "text" ? t.text : ""))).toEqual([
      "ab",
      "a",
      "ba",
    ]);
    expect(textTokens.map((t) => (t.type === "text" ? t.activeCount : 0))).toEqual([
      1,
      2,
      1,
    ]);
  });

  it("produces zero-length markers for zero-length range", () => {
    const result = buildHighlightLayout("ababa", [{ start: 2, end: 2 }]);
    const markers = result.tokens.filter((t) => t.type === "marker");
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.every((t) => t.type === "marker")).toBe(true);
  });

  it("handles repeated identical range (same range twice)", () => {
    const result = buildHighlightLayout("abc", [
      { start: 0, end: 2 },
      { start: 0, end: 2 },
    ]);
    const textTokens = result.tokens.filter((t) => t.type === "text");
    expect(textTokens.map((t) => (t.type === "text" ? t.activeCount : 0))).toContain(2);
  });

  it("handles multiline content", () => {
    const text = "line1\nline2";
    const result = buildHighlightLayout(text, [{ start: 0, end: 5 }]);
    const fullText = result.tokens
      .filter((t) => t.type === "text")
      .map((t) => (t.type === "text" ? t.text : ""))
      .join("");
    expect(fullText).toBe(text);
    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it("clamps ranges to text length", () => {
    const result = buildHighlightLayout("ab", [
      { start: 0, end: 10 },
      { start: -1, end: 1 },
    ]);
    const textTokens = result.tokens.filter((t) => t.type === "text");
    expect(textTokens.length).toBeGreaterThan(0);
    const joined = textTokens
      .map((t) => (t.type === "text" ? t.text : ""))
      .join("");
    expect(joined).toBe("ab");
  });

  it("three overlapping ranges produce activeCount 3 in overlap", () => {
    const result = buildHighlightLayout("xxxxx", [
      { start: 0, end: 5 },
      { start: 1, end: 4 },
      { start: 2, end: 3 },
    ]);
    const textTokens = result.tokens.filter((t) => t.type === "text");
    const withCount3 = textTokens.filter(
      (t) => t.type === "text" && (t as { activeCount: number }).activeCount === 3,
    );
    expect(withCount3.length).toBeGreaterThan(0);
  });
});
