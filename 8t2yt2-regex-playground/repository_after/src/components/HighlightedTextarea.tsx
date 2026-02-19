import React, { FunctionComponent, useEffect, useMemo, useRef } from "react";

import { HighlightRange, buildHighlightLayout } from "../utils/highlight";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  ranges: HighlightRange[];
  highlightEnabled: boolean;
  helperText?: string;
}

const HighlightedTextarea: FunctionComponent<Props> = ({
  id,
  label,
  value,
  onChange,
  ranges,
  highlightEnabled,
  helperText,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  const layout = useMemo(
    () =>
      highlightEnabled
        ? buildHighlightLayout(value, ranges)
        : { tokens: [{ type: "text", text: value, activeCount: 0 }] },
    [value, ranges, highlightEnabled],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (!textarea || !highlight) return;

    const syncScroll = () => {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    };

    textarea.addEventListener("scroll", syncScroll);
    return () => textarea.removeEventListener("scroll", syncScroll);
  }, []);

  if (!highlightEnabled) {
    return (
      <div>
        <div className="pb-0.5 flex justify-between items-center">
          <label
            htmlFor={id}
            className="uppercase font-semibold text-sm tracking-wide"
          >
            {label}
          </label>
          {helperText && (
            <span className="text-xs text-theme_textGray">{helperText}</span>
          )}
        </div>
        <textarea
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-sm border-3 border-black rounded-md w-full h-72 focus:border-none focus:border-theme_hotPink focus:ring focus:ring-theme_hotPink focus:ring-opacity-50 bg-white"
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="pb-0.5 flex justify-between items-center">
        <label
          htmlFor={id}
          className="uppercase font-semibold text-sm tracking-wide"
        >
          {label}
        </label>
        {helperText && (
          <span className="text-xs text-theme_textGray">{helperText}</span>
        )}
      </div>
      <div className="relative border-3 border-black rounded-md focus-within:border-none focus-within:border-theme_hotPink focus-within:ring focus-within:ring-theme_hotPink focus-within:ring-opacity-50 bg-white">
        <pre
          ref={highlightRef}
          aria-hidden
          className="font-mono text-sm whitespace-pre-wrap break-words px-3 py-2 text-gray-900 overflow-auto"
          style={{ minHeight: "18rem" }}
        >
          {layout.tokens.map((token, index) => {
            if (token.type === "marker") {
              return (
                <span
                  key={`marker-${index}`}
                  className="inline-block w-0 border-l-2 border-theme_hotPink h-[1.1em] align-text-bottom"
                />
              );
            }

            if (token.type === "text") {
              const className =
                token.activeCount === 0
                  ? ""
                  : token.activeCount === 1
                    ? "bg-theme_lightSkyBlue"
                    : token.activeCount === 2
                      ? "bg-theme_frenchSkyBlue"
                      : "bg-theme_rajah";
              return (
                <span key={`seg-${index}`} className={className}>
                  {token.text}
                </span>
              );
            }
            return null;
          })}
        </pre>
        <textarea
          ref={textareaRef}
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 w-full h-full font-mono text-sm px-3 py-2 bg-transparent text-transparent caret-gray-900 resize-none overflow-auto"
          style={{ caretColor: "#111827" }}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default HighlightedTextarea;
