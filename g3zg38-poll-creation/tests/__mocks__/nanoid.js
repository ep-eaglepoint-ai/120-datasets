/** Mock for nanoid so Jest (CJS) can load server code that imports ESM-only nanoid. Returns exactly `size` chars from [A-Za-z0-9_-] so pollId/optionId tests pass. */
function nanoid(size = 21) {
  return Array.from({ length: size }, (_, i) => 'abcdefghij'[i % 10]).join('');
}
module.exports = { nanoid };
