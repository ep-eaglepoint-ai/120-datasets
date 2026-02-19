import { useEffect, useMemo, useRef, useState } from "react";

import { MatchResult, RegexWorkerResult } from "../types/regex";
import {
  createRegexWorker,
  createRegexWorkerRequest,
} from "../utils/regexWorkerFactory";

interface Options {
  pattern: string;
  flags: string;
  text: string;
  debounceMs?: number;
  timeoutMs?: number;
  maxMatches?: number;
}

const emptyResult: RegexWorkerResult = {
  ok: true,
  error: undefined,
  matches: [],
  executionTimeMs: 0,
  truncated: false,
  groupDefs: [],
};

const advanceIndex = (str: string, index: number, unicode: boolean): number => {
  if (!unicode) return index + 1;
  const code = str.codePointAt(index);
  if (code === undefined) return index + 1;
  return index + (code > 0xffff ? 2 : 1);
};

const parseCapturingGroups = (pattern: string) => {
  const groups: Array<{
    index: number;
    name?: string;
    parentIndex?: number | null;
  }> = [];
  const stack: Array<{ capturingIndex: number | null }> = [];
  let inClass = false;
  let escaped = false;

  const getParentIndex = () => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].capturingIndex) return stack[i].capturingIndex;
    }
    return null;
  };

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "[" && !inClass) {
      inClass = true;
      continue;
    }

    if (char === "]" && inClass) {
      inClass = false;
      continue;
    }

    if (inClass) continue;

    if (char === "(") {
      let capturing = true;
      let name: string | undefined;

      if (pattern[i + 1] === "?") {
        const next = pattern[i + 2];
        if (next === ":" || next === "=" || next === "!" || next === ">") {
          capturing = false;
        } else if (next === "<") {
          const lookahead = pattern[i + 3];
          if (lookahead === "=" || lookahead === "!") {
            capturing = false;
          } else {
            capturing = true;
            let nameEnd = i + 3;
            while (nameEnd < pattern.length && pattern[nameEnd] !== ">") {
              nameEnd += 1;
            }
            if (nameEnd < pattern.length) {
              name = pattern.slice(i + 3, nameEnd);
              i = nameEnd;
            }
          }
        } else {
          capturing = false;
        }
      }

      if (capturing) {
        const index = groups.length + 1;
        const parentIndex = getParentIndex();
        groups.push({ index, name, parentIndex });
        stack.push({ capturingIndex: index });
      } else {
        stack.push({ capturingIndex: null });
      }
      continue;
    }

    if (char === ")") {
      if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  return groups;
};

const buildMatchResults = (
  re: RegExp,
  text: string,
  maxMatches: number,
): MatchResult[] => {
  const results: MatchResult[] = [];
  const groupDefs = parseCapturingGroups(re.source);
  const isIterative = re.global || re.sticky;

  const buildGroups = (match: RegExpExecArray) => {
    const baseStart = match.index;
    const baseEnd = match.index + match[0].length;
    let searchStart = baseStart;
    return groupDefs.map((def) => {
      const value = match[def.index];
      const textVal =
        value === undefined ? null : (value as string | null);
      let start: number | null = null;
      let end: number | null = null;
      if (textVal !== null && textVal !== undefined && textVal !== "") {
        const pos = text.indexOf(textVal, searchStart);
        if (pos !== -1 && pos + textVal.length <= baseEnd) {
          start = pos;
          end = pos + textVal.length;
          searchStart = end;
        }
      } else if (textVal === "") {
        start = searchStart;
        end = searchStart;
      }
      return {
        index: def.index,
        name: def.name,
        text: textVal,
        start,
        end,
        parentIndex: def.parentIndex ?? null,
      };
    });
  };

  if (!isIterative) {
    const match = re.exec(text);
    if (match) {
      results.push({
        index: match.index,
        end: match.index + match[0].length,
        match: match[0],
        groups: buildGroups(match),
      });
    }
    return results;
  }

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    results.push({
      index: match.index,
      end: match.index + match[0].length,
      match: match[0],
      groups: buildGroups(match),
    });

    if (results.length >= maxMatches) {
      break;
    }

    if (match[0].length === 0) {
      re.lastIndex = advanceIndex(text, re.lastIndex, re.unicode);
    }
  }

  return results;
};

const useRegexWorker = ({
  pattern,
  flags,
  text,
  debounceMs = 150,
  timeoutMs = 2000,
  maxMatches = 5000,
}: Options): RegexWorkerResult & { status: "idle" | "running" } => {
  const [result, setResult] = useState<RegexWorkerResult>(emptyResult);
  const [status, setStatus] = useState<"idle" | "running">("idle");
  const latestRequest = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const workerAvailableRef = useRef(true);

  const requestPayload = useMemo(
    () => createRegexWorkerRequest(pattern, flags, text, maxMatches),
    [pattern, flags, text, maxMatches],
  );

  useEffect(() => {
    if (!pattern) {
      setResult({ ...emptyResult, groupDefs: [] });
      setStatus("idle");
      return () => undefined;
    }

    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const debounceTimer = window.setTimeout(() => {
      const safeFallback = text.length <= 20000 && pattern.length <= 200;

      const runFallback = (errorMessage?: string) => {
        if (!safeFallback) {
          setResult({
            ok: false,
            error:
              errorMessage ||
              "Regex worker unavailable. Reduce input size or simplify the pattern.",
            matches: [],
            executionTimeMs: 0,
            truncated: false,
            groupDefs: [],
          });
          setStatus("idle");
          return;
        }

        try {
          const start = performance.now();
          const re = new RegExp(pattern, flags);
          const matches = buildMatchResults(re, text, maxMatches);
          const executionTimeMs = performance.now() - start;
          setResult({
            ok: true,
            error: undefined,
            matches,
            executionTimeMs,
            truncated: matches.length >= maxMatches,
            groupDefs: parseCapturingGroups(pattern),
          });
          setStatus("idle");
        } catch (err) {
          setResult({
            ok: false,
            error:
              err && (err as Error).message
                ? (err as Error).message
                : "Invalid regular expression",
            matches: [],
            executionTimeMs: 0,
            truncated: false,
            groupDefs: [],
          });
          setStatus("idle");
        }
      };

      if (!workerAvailableRef.current) {
        runFallback();
        return;
      }

      if (workerRef.current) {
        workerRef.current.terminate();
      }
      let worker: Worker;
      try {
        worker = createRegexWorker();
      } catch (err) {
        workerAvailableRef.current = false;
        runFallback("Regex worker failed to start. Falling back to safe mode.");
        return;
      }
      workerRef.current = worker;
      setStatus("running");

      const timeoutTimer = window.setTimeout(() => {
        worker.terminate();
        workerRef.current = null;
        if (latestRequest.current === requestId) {
          runFallback(
            `Execution exceeded ${timeoutMs}ms. Consider simplifying the pattern or reducing input size.`,
          );
        }
      }, timeoutMs);

      worker.onmessage = (event: MessageEvent<RegexWorkerResult>) => {
        if (latestRequest.current !== requestId) {
          worker.terminate();
          workerRef.current = null;
          return;
        }
        window.clearTimeout(timeoutTimer);
        setResult(event.data);
        setStatus("idle");
        worker.terminate();
        workerRef.current = null;
      };

      worker.onerror = () => {
        window.clearTimeout(timeoutTimer);
        worker.terminate();
        workerRef.current = null;
        if (latestRequest.current === requestId) {
          workerAvailableRef.current = false;
          runFallback(
            "Regex worker failed to start. Falling back to safe mode.",
          );
        }
      };

      worker.postMessage(requestPayload);
    }, debounceMs);

    return () => {
      window.clearTimeout(debounceTimer);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [requestPayload, debounceMs, timeoutMs, pattern, flags, text, maxMatches]);

  return { ...result, status };
};

export default useRegexWorker;
