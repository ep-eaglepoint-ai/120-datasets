# Trajectory (Thinking Process for Refactoring)

## 1. Audit the Original Code (Identify Load-Bearing Patterns)
I audited the original HFT bridge module. Beyond the code duplication, I identified critical "load-bearing bugs": a mutable default argument used for session persistence, specific rounding offsets (`0.0000001`) for ledger parity, and global state mutations scraped by external tools. Fixing these "bugs" would break the system.  
  
- **Mutable Default Pitfalls**: [Python Anti-Patterns: Mutable Default Arguments](https://docs.python-guide.org/writing/gotchas/#mutable-default-arguments) (Note: In this task, we *must* preserve this).

## 2. Define a Parity Contract First
I defined a strict parity contract: zero change to the public API (signatures/docstrings), bit-perfect state mutation order, and a line-count limit (+3 max). Efficiency gains must only come from structural consolidation, never from changing execution timing or precision.

## 3. Rework the Parsing as a Unified Pipeline
I replaced the repetitive `.upper().strip().split(":")` calls with a single internal `parse` lambda. This ensures that any input transformation is consistent across all usage nodes in the loop.

## 4. Consolidate Tiered Logic into Mappings
The `if/elif/else` chain for `uid` prefixes was consolidated into a `TIER_MAP`. This reduces cyclomatic complexity while maintaining the exact same functional priority through a `next()` generator expression.


## 5. Uphold Global State Visibility
I maintained `SYSTEM_STATE` and `LOG_BUFFER` as globals. Since downstream systems perform memory-scraping of these exact addresses, "pure-ifying" the functions would have blinded the monitoring tools.

## 6. Preserve Non-Standard Precision Logic
I strictly retained the `math.floor(amount + 0.0000001)` logic. In financial systems, even a 1-unit drift in the 10th decimal can cause ledger reconciliation failures.
- **Floating Point Precision**: [The Problem with Floating Point Numbers](https://floating-point-gui.de/)

## 7. Retain the "Prime-Gate" fraud detection
Despite its inefficiency, I preserved the original prime-checking algorithm. Optimizing it would alter the CPU execution time and potentially trigger "timing attack" alerts in the legacy fraud system.

## 8. Maintain Execution Dependency Order
I ensured that `validate_and_log` executes before `calculate_tier_bonus`. Since the latter reads from `SYSTEM_STATE` (which the former updates), swapping these would break the data dependency.

## 9. Verify with a Unified Verification Suite
I built a testing suite that loads both versions of the module simultaneously. This allows for direct comparison of outputs and global state mutations to prove bit-perfection.

## 10. Result: Structural Efficiency + Zero Behavioral Drift
The refactor reduced the line count by 7 lines and consolidated 3 redundant parsing blocks into 1, all while achieving 100% behavioral parity verified by the unified test suite.

---

### Trajectory Transferability Notes (Nodes)

The nodes extracted from this trajectory represent a templated thinking process for high-stakes mechanical refactoring:

- **Audit Node (Legacy Logic Detection)**: Identify "load-bearing bugs" versus "cleanup candidates."
- **Contract Node (Boundary Definition)**: Define API, line-count, and bit-parity constraints.
- **Consolidation Node (Mapping/Helper Logic)**: Swap repetitive conditionals for mappings/lookups.
- **Dependency Node (Execution Timing)**: Map side-effect order and data dependencies.
- **Verification Node (Unified Parity Suite)**: Direct side-by-side behavioral assertion.

**Transferability applies across categories:**
- **Refactoring → Performance**: Audit bottlenecks → Define SLO contract → Rework hot paths → Verify with benchmarks.
- **Refactoring → Security**: Audit vulnerabilities → Define threat model → Rework auth logic → Verify with pen-tests.
