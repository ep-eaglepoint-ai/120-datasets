import { RegexWorkerResult } from "../types/regex";

export interface RegexWorkerRequest {
  pattern: string;
  flags: string;
  text: string;
  maxMatches: number;
}

const workerSource = `
const supportsIndices = (() => {
  try {
    // eslint-disable-next-line no-new
    new RegExp('', 'd')
    return true
  } catch (err) {
    return false
  }
})()

const advanceIndex = (str, index, unicode) => {
  if (!unicode) return index + 1
  const code = str.codePointAt(index)
  if (code === undefined) return index + 1
  return index + (code > 0xFFFF ? 2 : 1)
}

const parseCapturingGroups = (pattern) => {
  const groups = []
  const stack = []
  let inClass = false
  let escaped = false

  const getParentIndex = () => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].capturingIndex) return stack[i].capturingIndex
    }
    return null
  }

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '[' && !inClass) {
      inClass = true
      continue
    }

    if (char === ']' && inClass) {
      inClass = false
      continue
    }

    if (inClass) continue

    if (char === '(') {
      let capturing = true
      let name

      if (pattern[i + 1] === '?') {
        const next = pattern[i + 2]
        if (next === ':' || next === '=' || next === '!' || next === '>') {
          capturing = false
        } else if (next === '<') {
          const lookahead = pattern[i + 3]
          if (lookahead === '=' || lookahead === '!') {
            capturing = false
          } else {
            capturing = true
            let nameEnd = i + 3
            while (nameEnd < pattern.length && pattern[nameEnd] !== '>') {
              nameEnd += 1
            }
            if (nameEnd < pattern.length) {
              name = pattern.slice(i + 3, nameEnd)
              i = nameEnd
            }
          }
        } else {
          capturing = false
        }
      }

      if (capturing) {
        const index = groups.length + 1
        const parentIndex = getParentIndex()
        groups.push({ index, name, parentIndex })
        stack.push({ capturingIndex: index })
      } else {
        stack.push({ capturingIndex: null })
      }
      continue
    }

    if (char === ')') {
      if (stack.length > 0) {
        stack.pop()
      }
    }
  }

  return groups
}

const buildGroups = (match, groupDefs, useIndices) => {
  const indices = useIndices && match.indices ? match.indices : null
  return groupDefs.map((def) => {
    const value = match[def.index]
    const indexTuple = indices && indices[def.index] ? indices[def.index] : null
    return {
      index: def.index,
      name: def.name,
      text: value === undefined ? null : value,
      start: indexTuple ? indexTuple[0] : null,
      end: indexTuple ? indexTuple[1] : null,
      parentIndex: def.parentIndex ?? null,
    }
  })
}

self.onmessage = (event) => {
  const { pattern, flags, text, maxMatches } = event.data

  const groupDefs = parseCapturingGroups(pattern || '')

  if (!pattern) {
    self.postMessage({
      ok: true,
      error: null,
      matches: [],
      executionTimeMs: 0,
      truncated: false,
      groupDefs,
    })
    return
  }

  let re
  let useIndices = false
  const safeFlags = flags || ''

  try {
    if (supportsIndices && !safeFlags.includes('d')) {
      re = new RegExp(pattern, safeFlags + 'd')
      useIndices = true
    } else {
      re = new RegExp(pattern, safeFlags)
      useIndices = supportsIndices && safeFlags.includes('d')
    }
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err && err.message ? err.message : 'Invalid regular expression',
      matches: [],
      executionTimeMs: 0,
      truncated: false,
      groupDefs,
    })
    return
  }

  const start = performance.now()
  const matches = []
  let truncated = false
  const isIterative = re.global || re.sticky

  if (!isIterative) {
    const match = re.exec(text)
    if (match) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        match: match[0],
        groups: buildGroups(match, groupDefs, useIndices),
      })
    }
  } else {
    let match
    while ((match = re.exec(text)) !== null) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        match: match[0],
        groups: buildGroups(match, groupDefs, useIndices),
      })

      if (matches.length >= maxMatches) {
        truncated = true
        break
      }

      if (match[0].length === 0) {
        re.lastIndex = advanceIndex(text, re.lastIndex, re.unicode)
      }
    }
  }

  const executionTimeMs = performance.now() - start

  self.postMessage({
    ok: true,
    error: null,
    matches,
    executionTimeMs,
    truncated,
    groupDefs,
  })
}
`;

export const createRegexWorker = (): Worker => {
  const blob = new Blob([workerSource], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
};

export const createRegexWorkerRequest = (
  pattern: string,
  flags: string,
  text: string,
  maxMatches: number,
): RegexWorkerRequest => ({
  pattern,
  flags,
  text,
  maxMatches,
});

export type RegexWorkerResponse = RegexWorkerResult;
