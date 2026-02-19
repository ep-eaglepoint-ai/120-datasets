import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

import RegexPlayground from "../repository_after/src/components/RegexPlayground";
import useRegexWorker from "../repository_after/src/hooks/useRegexWorker";

jest.mock("../repository_after/src/hooks/useRegexWorker");

const mockUseRegexWorker = useRegexWorker as jest.MockedFunction<
  typeof useRegexWorker
>;

const defaultHookValue: ReturnType<typeof useRegexWorker> = {
  ok: true,
  matches: [
    {
      index: 0,
      end: 3,
      match: "abc",
      groups: [
        {
          index: 1,
          name: "word",
          text: "abc",
          start: 0,
          end: 3,
          parentIndex: null,
        },
      ],
    },
  ],
  executionTimeMs: 1.25,
  truncated: false,
  error: undefined,
  groupDefs: [
    {
      index: 1,
      name: "word",
      parentIndex: null,
    },
  ],
  status: "idle",
};

describe("RegexPlayground UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseRegexWorker.mockReturnValue(defaultHookValue);
  });

  it("renders pattern input, flags, and test text area with monospaced styling", () => {
    render(<RegexPlayground />);

    const patternInput = screen.getByLabelText("Pattern");
    const testText = screen.getByLabelText("Test Text");

    expect(patternInput).toBeInTheDocument();
    expect(patternInput.className).toContain("font-mono");
    expect(testText).toBeInTheDocument();
    expect(testText.className).toContain("font-mono");
  });

  it("toggles flags and updates preview", () => {
    render(<RegexPlayground />);

    const preview = screen.getByText(/\/.+\/[a-z]*/i);
    expect(preview.textContent).toContain("/(?<word>\\w+)/g");

    const insensitiveToggle = screen.getByRole("button", {
      name: /i insensitive/i,
    });
    fireEvent.click(insensitiveToggle);

    expect(preview.textContent).toContain("/(?<word>\\w+)/gi");
  });

  it("renders all six flag toggles with correct labels", () => {
    render(<RegexPlayground />);

    expect(screen.getByRole("button", { name: /g\s+global/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i\s+insensitive/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /m\s+multiline/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /s\s+dotall/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /u\s+unicode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /y\s+sticky/i })).toBeInTheDocument();
  });

  it("disables highlighting when match count exceeds 5000", () => {
    const manyMatches = Array.from({ length: 5001 }, (_, i) => ({
      index: i * 2,
      end: i * 2 + 1,
      match: "x",
      groups: [],
    }));
    mockUseRegexWorker.mockReturnValue({
      ...defaultHookValue,
      matches: manyMatches,
    });

    render(<RegexPlayground />);

    expect(screen.getByText(/Highlighting disabled/i)).toBeInTheDocument();
  });

  it("renders pattern section, test text section, and results section", () => {
    render(<RegexPlayground />);

    expect(screen.getByLabelText("Pattern")).toBeInTheDocument();
    expect(screen.getByLabelText("Test Text")).toBeInTheDocument();
    expect(screen.getByText(/1 match/i)).toBeInTheDocument();
    expect(screen.getByText("Match 1")).toBeInTheDocument();
  });

  it("saves and restores all three keys (pattern, flags, text) in localStorage", () => {
    render(<RegexPlayground />);

    const patternInput = screen.getByLabelText("Pattern") as HTMLInputElement;
    const testText = screen.getByLabelText("Test Text") as HTMLTextAreaElement;
    fireEvent.change(patternInput, { target: { value: "\\d+" } });
    fireEvent.change(testText, { target: { value: "test 123" } });
    const stickyToggle = screen.getByRole("button", { name: /y\s+sticky/i });
    fireEvent.click(stickyToggle);

    expect(window.localStorage.getItem("regex-playground:pattern")).toBe('"\\\\d+"');
    expect(window.localStorage.getItem("regex-playground:text")).toBe('"test 123"');
    expect(window.localStorage.getItem("regex-playground:flags")).toBeDefined();
  });

  it("stores updates in localStorage", () => {
    render(<RegexPlayground />);

    const patternInput = screen.getByLabelText("Pattern") as HTMLInputElement;
    fireEvent.change(patternInput, { target: { value: "abc" } });

    expect(window.localStorage.getItem("regex-playground:pattern")).toBe(
      '"abc"',
    );
  });

  it("restores state from localStorage on reload (deterministic)", () => {
    window.localStorage.setItem(
      "regex-playground:pattern",
      JSON.stringify("xyz"),
    );
    window.localStorage.setItem("regex-playground:flags", JSON.stringify("gi"));
    window.localStorage.setItem(
      "regex-playground:text",
      JSON.stringify("xyz xyz"),
    );

    render(<RegexPlayground />);

    const patternInput = screen.getByLabelText("Pattern") as HTMLInputElement;
    const preview = screen.getByText(/\/xyz\/gi/);
    const testText = screen.getByLabelText("Test Text") as HTMLTextAreaElement;

    expect(patternInput.value).toBe("xyz");
    expect(preview).toBeInTheDocument();
    expect(testText.value).toBe("xyz xyz");
  });

  it("disables highlighting for large text input", () => {
    const largeText = "a".repeat(250000);
    window.localStorage.setItem(
      "regex-playground:text",
      JSON.stringify(largeText),
    );

    render(<RegexPlayground />);

    expect(screen.getByText(/Highlighting disabled/i)).toBeInTheDocument();
  });

  it("shows match metadata and capture groups", () => {
    render(<RegexPlayground />);

    expect(screen.getByText(/1 match/i)).toBeInTheDocument();
    expect(screen.getAllByText("[0, 3)")).toHaveLength(2);
    expect(screen.getByText("Match 1")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("(word)")).toBeInTheDocument();
    expect(screen.getAllByText("abc")).toHaveLength(2);
  });

  it("handles invalid regex errors gracefully when hook returns error", () => {
    mockUseRegexWorker.mockReturnValue({
      ok: false,
      matches: [],
      executionTimeMs: 0,
      truncated: false,
      error: "Invalid regular expression",
      groupDefs: [],
      status: "idle",
    });

    render(<RegexPlayground />);

    expect(screen.getByText("Regex Error")).toBeInTheDocument();
    expect(screen.getByText(/Invalid regular expression/)).toBeInTheDocument();
  });

  it("shows regex error for real invalid pattern without throwing", () => {
    jest.useFakeTimers();
    jest.unmock("../repository_after/src/hooks/useRegexWorker");
    const useRegexWorkerReal = jest.requireActual<
      typeof import("../repository_after/src/hooks/useRegexWorker")
    >("../repository_after/src/hooks/useRegexWorker").default;
    mockUseRegexWorker.mockImplementation(useRegexWorkerReal);

    window.localStorage.clear();
    render(<RegexPlayground />);

    const patternInput = screen.getByLabelText("Pattern") as HTMLInputElement;
    fireEvent.change(patternInput, { target: { value: "[" } });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByText("Regex Error")).toBeInTheDocument();
    expect(screen.getByText(/Unterminated character class/i)).toBeInTheDocument();

    jest.useRealTimers();
    mockUseRegexWorker.mockReturnValue(defaultHookValue);
  });
});
