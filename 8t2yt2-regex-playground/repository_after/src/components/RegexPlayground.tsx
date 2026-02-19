import React, { FunctionComponent, useMemo } from "react";

import FlagToggles from "./FlagToggles";
import HighlightedTextarea from "./HighlightedTextarea";
import MatchResults from "./MatchResults";
import useLocalStorageState from "../hooks/useLocalStorageState";
import useRegexWorker from "../hooks/useRegexWorker";

const DEFAULT_PATTERN = "(?<word>\\w+)";
const DEFAULT_TEXT = `Regex playground\n\nTry patterns with groups, flags, and Unicode: 😊 café naïve\nLine two: alpha_beta123\n\nUse anchors, lookarounds, and named groups to inspect results.`;
const DEFAULT_FLAGS = "g";
const FLAG_ORDER = ["g", "i", "m", "s", "u", "y"];

const RegexPlayground: FunctionComponent = () => {
  const [pattern, setPattern] = useLocalStorageState(
    "regex-playground:pattern",
    DEFAULT_PATTERN,
  );
  const [flags, setFlags] = useLocalStorageState(
    "regex-playground:flags",
    DEFAULT_FLAGS,
  );
  const [text, setText] = useLocalStorageState(
    "regex-playground:text",
    DEFAULT_TEXT,
  );

  const { matches, executionTimeMs, truncated, error, status } = useRegexWorker(
    {
      pattern,
      flags,
      text,
    },
  );

  const highlightRanges = useMemo(
    () => matches.map((match) => ({ start: match.index, end: match.end })),
    [matches],
  );

  const highlightEnabled = text.length <= 200000 && matches.length <= 5000;
  const helperText = highlightEnabled
    ? "Matches highlighted in real time."
    : "Highlighting disabled for large input or many matches.";

  const toggleFlag = (flag: string) => {
    const set = new Set(flags.split(""));
    if (set.has(flag)) {
      set.delete(flag);
    } else {
      set.add(flag);
    }
    const next = FLAG_ORDER.filter((item) => set.has(item)).join("");
    setFlags(next);
  };

  const resetState = () => {
    setPattern(DEFAULT_PATTERN);
    setFlags(DEFAULT_FLAGS);
    setText(DEFAULT_TEXT);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section className="space-y-6">
        <div className="bg-white border-t-4 border-theme_slateBlue px-5 py-4">
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="pattern"
                className="uppercase font-semibold text-sm tracking-wide"
              >
                Pattern
              </label>
              <input
                id="pattern"
                name="pattern"
                type="text"
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                className="mt-1 font-mono text-sm border-3 border-black rounded-md w-full focus:border-none focus:border-theme_hotPink focus:ring focus:ring-theme_hotPink focus:ring-opacity-50"
                placeholder="Enter a regular expression pattern"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div>
              <div className="uppercase font-semibold text-sm tracking-wide">
                Flags
              </div>
              <FlagToggles flags={flags} onToggle={toggleFlag} />
              <div className="text-xs text-theme_textGray mt-1 font-mono">
                /{pattern || ""}/{flags || ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetState}
                className="px-3 py-2 text-sm font-semibold border-2 border-theme_slateBlue text-theme_slateBlue rounded hover:text-theme_hotPink hover:border-theme_hotPink"
              >
                Reset
              </button>
              <div className="text-xs text-theme_textGray self-center">
                State saved locally.
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-t-4 border-theme_slateBlue px-5 py-4">
          <HighlightedTextarea
            id="test-text"
            label="Test Text"
            value={text}
            onChange={setText}
            ranges={highlightRanges}
            highlightEnabled={highlightEnabled}
            helperText={helperText}
          />
        </div>
      </section>

      <section className="space-y-6">
        <MatchResults
          matches={matches}
          executionTimeMs={executionTimeMs}
          truncated={truncated}
          error={error}
          status={status}
        />
      </section>
    </div>
  );
};

export default RegexPlayground;
