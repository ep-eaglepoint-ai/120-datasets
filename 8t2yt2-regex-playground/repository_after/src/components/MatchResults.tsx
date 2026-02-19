import React, { FunctionComponent } from "react";

import { MatchResult } from "../types/regex";

interface Props {
  matches: MatchResult[];
  executionTimeMs: number;
  truncated: boolean;
  error?: string;
  status: "idle" | "running";
}

const MatchResults: FunctionComponent<Props> = ({
  matches,
  executionTimeMs,
  truncated,
  error,
  status,
}) => {
  if (error) {
    return (
      <div className="bg-white border-t-4 border-theme_hotPink px-5 py-4">
        <h3 className="font-semibold text-theme_hotPink">Regex Error</h3>
        <p className="text-sm text-theme_textGray mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border-t-4 border-theme_slateBlue px-5 py-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="font-semibold text-theme_slateBlue">
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </div>
          <div className="text-theme_textGray">
            Execution: {executionTimeMs.toFixed(2)}ms
          </div>
          {status === "running" && (
            <div className="text-theme_textGray">Running…</div>
          )}
          {truncated && (
            <div className="text-theme_hotPink">Results truncated</div>
          )}
        </div>
      </div>

      {matches.length === 0 && (
        <div className="bg-white border-2 border-dashed border-theme_lavenderBlue px-5 py-6 text-center text-theme_textGray text-sm">
          No matches to display. Adjust your pattern, flags, or test text.
        </div>
      )}

      {matches.map((match, matchIndex) => (
        <div
          key={`match-${matchIndex}`}
          className="bg-white border-2 border-theme_lavenderBlue rounded"
        >
          <div className="px-4 py-3 border-b border-theme_lavenderBlue flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm font-semibold text-theme_slateBlue">
              Match {matchIndex + 1}
            </div>
            <div className="text-xs text-theme_textGray font-mono">
              [{match.index}, {match.end})
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs uppercase text-theme_textGray tracking-wide">
              Matched Text
            </div>
            <div className="font-mono text-sm bg-theme_gray p-2 rounded mt-1 overflow-x-auto">
              {match.match || (
                <span className="text-theme_textGray">(empty)</span>
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase text-theme_textGray tracking-wide">
                Capture Groups
              </div>
              {match.groups.length === 0 && (
                <div className="text-sm text-theme_textGray mt-1">
                  No capturing groups.
                </div>
              )}
              {match.groups.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {match.groups.map((group) => {
                    const indent = group.parentIndex
                      ? "pl-4 border-l-2 border-theme_lavenderBlue"
                      : "";
                    return (
                      <li
                        key={`group-${matchIndex}-${group.index}`}
                        className={`text-sm ${indent}`}
                      >
                        <div className="flex flex-wrap gap-2 items-baseline">
                          <span className="font-mono text-theme_slateBlue">
                            #{group.index}
                          </span>
                          {group.name && (
                            <span className="text-xs text-theme_textGray">
                              ({group.name})
                            </span>
                          )}
                          {group.parentIndex && (
                            <span className="text-xs text-theme_textGray">
                              parent #{group.parentIndex}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-sm bg-theme_gray p-2 rounded mt-1 overflow-x-auto">
                          {group.text ?? (
                            <span className="text-theme_textGray">(empty)</span>
                          )}
                        </div>
                        {group.start != null && group.end != null && (
                          <div className="text-xs text-theme_textGray mt-1">
                            [{group.start}, {group.end})
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MatchResults;
