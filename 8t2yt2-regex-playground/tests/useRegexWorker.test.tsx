import React, { act } from "react";
import { render, screen } from "@testing-library/react";

import useRegexWorker from "../repository_after/src/hooks/useRegexWorker";
import { createRegexWorker } from "../repository_after/src/utils/regexWorkerFactory";

jest.mock("../repository_after/src/utils/regexWorkerFactory", () => ({
  ...jest.requireActual("../repository_after/src/utils/regexWorkerFactory"),
  createRegexWorker: jest.fn(),
}));

const mockedCreateRegexWorker = createRegexWorker as jest.MockedFunction<
  typeof createRegexWorker
>;

const HookConsumer = ({
  pattern,
  flags,
  text,
  timeoutMs = 50,
  debounceMs = 0,
  maxMatches,
}: {
  pattern: string;
  flags: string;
  text: string;
  timeoutMs?: number;
  debounceMs?: number;
  maxMatches?: number;
}) => {
  const { error, matches } = useRegexWorker({
    pattern,
    flags,
    text,
    debounceMs,
    timeoutMs,
    maxMatches,
  });

  return (
    <div>
      <div data-testid="error">{error || ""}</div>
      <div data-testid="count">{matches.length}</div>
      {matches[0] && (
        <div data-testid="first-match">
          {matches[0].index},{matches[0].end}
        </div>
      )}
    </div>
  );
};

describe("useRegexWorker", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedCreateRegexWorker.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("returns matches when worker responds", () => {
    const worker = {
      onmessage: null as ((event: { data: any }) => void) | null,
      onerror: null as (() => void) | null,
      postMessage: function postMessage() {
        this.onmessage?.({
          data: {
            ok: true,
            error: null,
            matches: [
              {
                index: 0,
                end: 2,
                match: "😊",
                groups: [],
              },
            ],
            executionTimeMs: 0.5,
            truncated: false,
            groupDefs: [],
          },
        });
      },
      terminate: jest.fn(),
    };

    mockedCreateRegexWorker.mockReturnValue(worker as unknown as Worker);

    render(
      <HookConsumer pattern="😊" flags="g" text="😊" debounceMs={0} />,
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("surfaces timeout error when worker does not respond", () => {
    const worker = {
      onmessage: null as ((event: { data: any }) => void) | null,
      onerror: null as (() => void) | null,
      postMessage: jest.fn(),
      terminate: jest.fn(),
    };

    mockedCreateRegexWorker.mockReturnValue(worker as unknown as Worker);

    render(
      <HookConsumer
        pattern={"(a+)+$" + " ".repeat(200)}
        flags=""
        text="aaaaaaaaaa"
        debounceMs={0}
        timeoutMs={10}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(20);
    });

    expect(screen.getByTestId("error").textContent).toMatch(
      /Execution exceeded 10ms/,
    );
  });

  it("returns zero matches for empty pattern without posting to worker", () => {
    const postMessage = jest.fn();
    const worker = {
      onmessage: null as ((event: { data: any }) => void) | null,
      onerror: null as (() => void) | null,
      postMessage,
      terminate: jest.fn(),
    };
    mockedCreateRegexWorker.mockReturnValue(worker as unknown as Worker);

    render(<HookConsumer pattern="" flags="g" text="hello" />);

    act(() => {
      jest.runAllTimers();
    });

    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("debounces: does not post immediately; posts after debounceMs", () => {
    const postMessage = jest.fn();
    const worker = {
      onmessage: null as ((event: { data: any }) => void) | null,
      onerror: null as (() => void) | null,
      postMessage,
      terminate: jest.fn(),
    };
    mockedCreateRegexWorker.mockReturnValue(worker as unknown as Worker);

    render(
      <HookConsumer
        pattern="a"
        flags="g"
        text="a"
        debounceMs={100}
      />,
    );

    expect(postMessage).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("sends correct payload (pattern, flags, text, maxMatches) to worker", () => {
    const postMessage = jest.fn();
    const worker = {
      onmessage: null as ((event: { data: any }) => void) | null,
      onerror: null as (() => void) | null,
      postMessage,
      terminate: jest.fn(),
    };
    mockedCreateRegexWorker.mockReturnValue(worker as unknown as Worker);

    const pattern = "\\d+";
    const flags = "gi";
    const text = "test 123";
    const maxMatches = 1000;

    render(
      <HookConsumer
        pattern={pattern}
        flags={flags}
        text={text}
        debounceMs={0}
        maxMatches={maxMatches}
      />,
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const payload = postMessage.mock.calls[0][0];
    expect(payload).toMatchObject({ flags, text, maxMatches });
    // pattern may be "\d+" or "\\d+" depending on runtime (backslash escaping)
    expect(payload.pattern).toMatch(/^\\+d\+$/);
  });

  it("returns matches for accented character (Unicode)", () => {
    const worker = {
      onmessage: null as ((event: { data: any }) => void) | null,
      onerror: null as (() => void) | null,
      postMessage: function postMessage() {
        this.onmessage?.({
          data: {
            ok: true,
            error: null,
            matches: [
              {
                index: 4,
                end: 8,
                match: "café",
                groups: [],
              },
            ],
            executionTimeMs: 0.1,
            truncated: false,
            groupDefs: [],
          },
        });
      },
      terminate: jest.fn(),
    };
    mockedCreateRegexWorker.mockReturnValue(worker as unknown as Worker);

    render(
      <HookConsumer
        pattern="café"
        flags="u"
        text="hello café"
        debounceMs={0}
      />,
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("first-match").textContent).toBe("4,8");
  });

  it("deterministic: same pattern, flags, text yield same match count and indices", () => {
    const worker = {
      onmessage: null as ((event: { data: any }) => void) | null,
      onerror: null as (() => void) | null,
      postMessage: function postMessage() {
        this.onmessage?.({
          data: {
            ok: true,
            error: null,
            matches: [
              { index: 0, end: 1, match: "a", groups: [] },
              { index: 2, end: 3, match: "a", groups: [] },
            ],
            executionTimeMs: 0.1,
            truncated: false,
            groupDefs: [],
          },
        });
      },
      terminate: jest.fn(),
    };
    mockedCreateRegexWorker.mockReturnValue(worker as unknown as Worker);

    const { rerender } = render(
      <HookConsumer pattern="a" flags="g" text="a a" debounceMs={0} />,
    );
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const count1 = screen.getByTestId("count").textContent;
    const first1 = screen.getByTestId("first-match").textContent;

    rerender(
      <HookConsumer pattern="a" flags="g" text="a a" debounceMs={0} />,
    );
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const count2 = screen.getByTestId("count").textContent;
    const first2 = screen.getByTestId("first-match").textContent;

    expect(count1).toBe(count2);
    expect(first1).toBe(first2);
    expect(count1).toBe("2");
    expect(first1).toBe("0,1");
  });
});
